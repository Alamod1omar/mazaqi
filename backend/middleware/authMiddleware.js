const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET || 'mazaki_secret_key';

module.exports = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'توثيق مطلوب' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'جلسة منتهية أو غير صالحة' });
        }
        req.user = user;
        next();
    });
};
