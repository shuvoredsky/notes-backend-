const cleanObject = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      if (obj[i] && typeof obj[i] === 'object') {
        cleanObject(obj[i]);
      }
    }
    return;
  }

  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else if (obj[key] && typeof obj[key] === 'object') {
      cleanObject(obj[key]);
    }
  }
};

const sanitize = (req, res, next) => {
  if (req.body) cleanObject(req.body);
  if (req.params) cleanObject(req.params);
  if (req.query) cleanObject(req.query);
  next();
};

module.exports = sanitize;
