const getPagination = (query = {}) => {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (isNaN(page) || page < 1) {
    page = 1;
  }

  if (isNaN(limit) || limit < 1) {
    limit = 10;
  } else if (limit > 50) {
    limit = 50;
  }

  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

const buildMeta = (total, page, limit) => {
  return {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit)
  };
};

module.exports = {
  getPagination,
  buildMeta
};
