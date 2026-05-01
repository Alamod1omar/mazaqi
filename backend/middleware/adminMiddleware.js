const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET || 'mazaki_secret_key';

module.exports = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'دخول المسؤول مطلوب' });
    }

    jwt.verify(token, SECRET_KEY, (err, admin) => {
        if (err || !admin.isAdmin) {
            return res.status(403).json({ message: 'غير مصرح لك بالدخول' });
        }
        req.admin = admin;
        next();
    });
};
