const GroupVault = require('../models/GroupVault');
const GroupVaultItem = require('../models/GroupVaultItem');
const Watchlist = require('../models/Watchlist');
const Friendship = require('../models/Friendship');
const ApiResponse = require('../utils/apiResponse');

// ============================================
// HELPER: Verify user is a member of a group vault
// ============================================
const verifyMembership = async (vaultId, userId) => {
    const vault = await GroupVault.findOne({
        _id: vaultId,
        'members.user': userId,
        isActive: true,
    });
    return vault;
};

// ============================================
// @desc    Create a new group vault
// @route   POST /api/groups
// @access  Private
// @body    { name, description, memberIds }
// ============================================
const createGroupVault = async (req, res, next) => {
    try {
        const { name, description, memberIds } = req.body;

        if (!name) {
            return ApiResponse.error(res, 400, 'Group vault name is required');
        }

        // Verify all memberIds are friends
        if (memberIds && memberIds.length > 0) {
            const friendships = await Friendship.find({
                $or: [
                    { requester: req.user.id, recipient: { $in: memberIds } },
                    { requester: { $in: memberIds }, recipient: req.user.id },
                ],
                status: 'accepted',
            });

            if (friendships.length !== memberIds.length) {
                return ApiResponse.error(
                    res,
                    400,
                    'All members must be your friends'
                );
            }
        }

        // Build members array (creator is admin)
        const members = [
            { user: req.user.id, role: 'admin', joinedAt: new Date() },
        ];

        if (memberIds) {
            memberIds.forEach((id) => {
                members.push({ user: id, role: 'member', joinedAt: new Date() });
            });
        }

        const vault = await GroupVault.create({
            name,
            description: description || '',
            createdBy: req.user.id,
            members,
        });

        await vault.populate('members.user', 'name uniqueId');

        return ApiResponse.success(res, 201, 'Group vault created', vault);
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Get all my group vaults
// @route   GET /api/groups
// @access  Private
// ============================================
const getMyGroupVaults = async (req, res, next) => {
    try {
        const vaults = await GroupVault.find({
            'members.user': req.user.id,
            isActive: true,
        })
            .populate('members.user', 'name uniqueId')
            .populate('createdBy', 'name uniqueId')
            .sort({ updatedAt: -1 })
            .lean();

        // Get item count for each vault
        const vaultsWithCounts = await Promise.all(
            vaults.map(async (vault) => {
                const itemCount = await GroupVaultItem.countDocuments({
                    groupVault: vault._id,
                });
                return { ...vault, itemCount };
            })
        );

        return ApiResponse.success(res, 200, 'Group vaults retrieved', {
            vaults: vaultsWithCounts,
            total: vaultsWithCounts.length,
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Get group vault details with items
// @route   GET /api/groups/:id
// @access  Private
// ============================================
const getGroupVaultDetails = async (req, res, next) => {
    try {
        const vault = await verifyMembership(req.params.id, req.user.id);

        if (!vault) {
            return ApiResponse.error(res, 404, 'Group vault not found or access denied');
        }

        await vault.populate('members.user', 'name uniqueId');
        await vault.populate('createdBy', 'name uniqueId');

        // Get all items in this vault
        const items = await GroupVaultItem.find({ groupVault: vault._id })
            .populate('addedBy', 'name uniqueId')
            .populate('watchedBy.user', 'name uniqueId')
            .sort({ updatedAt: -1 })
            .lean();

        // Calculate watch stats per item
        const itemsWithStats = items.map((item) => ({
            ...item,
            totalWatchedBy: item.watchedBy.length,
            totalMembers: vault.members.length,
            watchProgress: Math.round(
                (item.watchedBy.length / vault.members.length) * 100
            ),
            isWatchedByMe: item.watchedBy.some(
                (w) => w.user._id.toString() === req.user.id
            ),
        }));

        return ApiResponse.success(res, 200, 'Group vault details', {
            vault: vault.toObject(),
            items: itemsWithStats,
            totalItems: items.length,
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Add item to group vault
// @route   POST /api/groups/:id/items
// @access  Private
// ============================================
const addItemToGroupVault = async (req, res, next) => {
    try {
        const vault = await verifyMembership(req.params.id, req.user.id);

        if (!vault) {
            return ApiResponse.error(res, 404, 'Group vault not found or access denied');
        }

        const {
            contentId,
            contentType,
            title,
            posterUrl,
            overview,
            metadata,
        } = req.body;

        if (!contentId || !contentType || !title) {
            return ApiResponse.error(res, 400, 'contentId, contentType, and title are required');
        }

        // Check if already in group vault
        const existing = await GroupVaultItem.findOne({
            groupVault: vault._id,
            contentId: String(contentId),
            contentType,
        });

        if (existing) {
            return ApiResponse.error(res, 409, 'This item is already in the group vault');
        }

        // Check if the current user has watched this (auto-sync)
        const personalWatched = await Watchlist.findOne({
            user: req.user.id,
            contentId: String(contentId),
            contentType,
            status: 'watched',
        });

        const watchedBy = [];
        if (personalWatched) {
            watchedBy.push({
                user: req.user.id,
                watchedAt: new Date(),
                rating: personalWatched.rating,
            });
        }

        const item = await GroupVaultItem.create({
            groupVault: vault._id,
            contentId: String(contentId),
            contentType,
            title,
            posterUrl: posterUrl || null,
            overview: overview || '',
            addedBy: req.user.id,
            watchedBy,
            metadata: metadata || {},
        });

        await item.populate('addedBy', 'name uniqueId');
        await item.populate('watchedBy.user', 'name uniqueId');

        return ApiResponse.success(res, 201, 'Item added to group vault', item);
    } catch (error) {
        if (error.code === 11000) {
            return ApiResponse.error(res, 409, 'Item already in group vault');
        }
        next(error);
    }
};

// ============================================
// @desc    Mark item as watched in group vault (auto-sync)
// @route   PUT /api/groups/:vaultId/items/:itemId/watch
// @access  Private
// ============================================
const markWatchedInGroup = async (req, res, next) => {
    try {
        const { vaultId, itemId } = req.params;
        const { rating } = req.body;

        const vault = await verifyMembership(vaultId, req.user.id);
        if (!vault) {
            return ApiResponse.error(res, 404, 'Group vault not found');
        }

        const item = await GroupVaultItem.findOne({
            _id: itemId,
            groupVault: vaultId,
        });

        if (!item) {
            return ApiResponse.error(res, 404, 'Item not found in group vault');
        }

        // Check if already marked by this user
        const alreadyWatched = item.watchedBy.some(
            (w) => w.user.toString() === req.user.id
        );

        if (alreadyWatched) {
            return ApiResponse.error(res, 409, 'You have already marked this as watched');
        }

        // Add to watchedBy array
        item.watchedBy.push({
            user: req.user.id,
            watchedAt: new Date(),
            rating: rating || null,
        });

        await item.save();
        await item.populate('watchedBy.user', 'name uniqueId');

        return ApiResponse.success(res, 200, 'Marked as watched in group vault', {
            item,
            totalWatchedBy: item.watchedBy.length,
            totalMembers: vault.members.length,
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    AUTO-SYNC: When user marks watched in personal watchlist,
//          auto-update all group vaults they're in
// @route   Called internally (not a direct route)
// @access  Internal
// ============================================
const autoSyncWatchedToGroups = async (userId, contentId, contentType, rating) => {
    try {
        // Find all group vaults this user is a member of
        const vaults = await GroupVault.find({
            'members.user': userId,
            isActive: true,
        });

        for (const vault of vaults) {
            // Find if this content exists in the group vault
            const item = await GroupVaultItem.findOne({
                groupVault: vault._id,
                contentId: String(contentId),
                contentType,
            });

            if (item) {
                // Check if already watched by this user in the group
                const alreadyWatched = item.watchedBy.some(
                    (w) => w.user.toString() === userId
                );

                if (!alreadyWatched) {
                    item.watchedBy.push({
                        user: userId,
                        watchedAt: new Date(),
                        rating: rating || null,
                    });
                    await item.save();
                    console.log(
                        `🔄 Auto-synced "${item.title}" as watched in group "${vault.name}" for user ${userId}`
                    );
                }
            }
        }
    } catch (error) {
        console.error('❌ Auto-sync error:', error.message);
        // Don't throw — this is a background task, shouldn't block the main flow
    }
};

// ============================================
// @desc    Add member to group vault
// @route   POST /api/groups/:id/members
// @access  Private (admin only)
// ============================================
const addMember = async (req, res, next) => {
    try {
        const vault = await verifyMembership(req.params.id, req.user.id);

        if (!vault) {
            return ApiResponse.error(res, 404, 'Group vault not found');
        }

        // Check if requester is admin
        const requesterMember = vault.members.find(
            (m) => m.user.toString() === req.user.id
        );
        if (requesterMember.role !== 'admin') {
            return ApiResponse.error(res, 403, 'Only admins can add members');
        }

        const { userId } = req.body;

        if (!userId) {
            return ApiResponse.error(res, 400, 'userId is required');
        }

        // Check if already a member
        const alreadyMember = vault.members.some(
            (m) => m.user.toString() === userId
        );
        if (alreadyMember) {
            return ApiResponse.error(res, 409, 'User is already a member');
        }

        // Verify they are friends
        const friendship = await Friendship.findOne({
            $or: [
                { requester: req.user.id, recipient: userId },
                { requester: userId, recipient: req.user.id },
            ],
            status: 'accepted',
        });

        if (!friendship) {
            return ApiResponse.error(res, 400, 'User must be your friend to add to group');
        }

        vault.members.push({
            user: userId,
            role: 'member',
            joinedAt: new Date(),
        });

        await vault.save();
        await vault.populate('members.user', 'name uniqueId');

        return ApiResponse.success(res, 200, 'Member added to group vault', vault);
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Remove member from group vault
// @route   DELETE /api/groups/:id/members/:userId
// @access  Private (admin only)
// ============================================
const removeMember = async (req, res, next) => {
    try {
        const vault = await verifyMembership(req.params.id, req.user.id);

        if (!vault) {
            return ApiResponse.error(res, 404, 'Group vault not found');
        }

        const requesterMember = vault.members.find(
            (m) => m.user.toString() === req.user.id
        );
        if (requesterMember.role !== 'admin') {
            return ApiResponse.error(res, 403, 'Only admins can remove members');
        }

        const { userId } = req.params;

        if (userId === req.user.id) {
            return ApiResponse.error(res, 400, 'Admin cannot remove themselves. Delete the vault instead.');
        }

        vault.members = vault.members.filter(
            (m) => m.user.toString() !== userId
        );

        await vault.save();

        return ApiResponse.success(res, 200, 'Member removed from group vault');
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Delete group vault
// @route   DELETE /api/groups/:id
// @access  Private (creator only)
// ============================================
const deleteGroupVault = async (req, res, next) => {
    try {
        const vault = await GroupVault.findOne({
            _id: req.params.id,
            createdBy: req.user.id,
        });

        if (!vault) {
            return ApiResponse.error(res, 404, 'Group vault not found or you are not the creator');
        }

        // Delete all items in the vault
        await GroupVaultItem.deleteMany({ groupVault: vault._id });

        // Soft delete the vault
        vault.isActive = false;
        await vault.save();

        return ApiResponse.success(res, 200, 'Group vault deleted');
    } catch (error) {
        next(error);
    }
};

// ============================================
// @desc    Remove item from group vault
// @route   DELETE /api/groups/:vaultId/items/:itemId
// @access  Private
// ============================================
const removeItemFromGroup = async (req, res, next) => {
    try {
        const { vaultId, itemId } = req.params;

        const vault = await verifyMembership(vaultId, req.user.id);
        if (!vault) {
            return ApiResponse.error(res, 404, 'Group vault not found');
        }

        const item = await GroupVaultItem.findOneAndDelete({
            _id: itemId,
            groupVault: vaultId,
        });

        if (!item) {
            return ApiResponse.error(res, 404, 'Item not found in group vault');
        }

        return ApiResponse.success(res, 200, 'Item removed from group vault');
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createGroupVault,
    getMyGroupVaults,
    getGroupVaultDetails,
    addItemToGroupVault,
    markWatchedInGroup,
    autoSyncWatchedToGroups,
    addMember,
    removeMember,
    deleteGroupVault,
    removeItemFromGroup,
};