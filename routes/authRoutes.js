const express = require('express');
const router = express.Router();

// TODO: Implement in Phase 2
// router.post('/register', register);
// router.post('/login', login);
// router.post('/forgot-password', forgotPassword);
// router.put('/reset-password/:token', resetPassword);

router.get('/', (req, res) => {
    res.json({ message: 'Auth routes - Coming in Phase 2' });
});

module.exports = router;