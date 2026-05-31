const sendSuccess = (res, data = {}, meta, statusCode = 200) => {
  const payload = {
    success: true,
    data,
  };

  if (meta !== undefined) {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
};

const sendError = (
  res,
  {
    code = "INTERNAL_ERROR",
    message = "Something went wrong",
    details = {},
    statusCode = 500,
  } = {},
) =>
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
  });

module.exports = {
  sendSuccess,
  sendError,
};
