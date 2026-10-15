const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    createGroupVault,
    getMyGroupVaults,
    getGroupVaultDetails,
    addItemToGroupVault,
    markWatchedInGroup,
    addMember,
    removeMember,
    deleteGroupVault,
    removeItemFromGroup,
} = require('../controllers/groupVaultController');

router.use(protect);

// Group vault CRUD
router.get('/', getMyGroupVaults);
router.post('/', createGroupVault);
router.get('/:id', getGroupVaultDetails);
router.delete('/:id', deleteGroupVault);

// Items
router.post('/:id/items', addItemToGroupVault);
router.put('/:vaultId/items/:itemId/watch', markWatchedInGroup);
router.delete('/:vaultId/items/:itemId', removeItemFromGroup);

// Members
router.post('/:id/members', addMember);
router.delete('/:id/members/:userId', removeMember);

module.exports = router;