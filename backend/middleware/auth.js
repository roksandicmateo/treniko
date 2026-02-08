const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT token and extract user/tenant information
 * Attaches user data to req.user for use in route handlers
 */
const authenticateToken = (req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'No token provided' 
    });
  }

  // Verify token
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        error: 'Invalid token',
        message: 'Token verification failed' 
      });
    }

    // Attach user info to request object
    req.user = {
      userId: user.userId,
      tenantId: user.tenantId,
      email: user.email
    };

    next();
  });
};

/**
 * Middleware to validate tenant access
 * Ensures user can only access data from their own tenant
 */
const validateTenantAccess = (req, res, next) => {
  const { tenantId } = req.user;
  
  // Check if tenant_id in request body/params matches user's tenant
  const requestTenantId = req.body.tenant_id || req.params.tenant_id;
  
  if (requestTenantId && requestTenantId !== tenantId) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access to this tenant data is not allowed'
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  validateTenantAccess
};
