type ResponseProp = {
  message?: string;
  data?: any;
};
module.exports = {
  ErrorResponse: ({ message = "", data }: ResponseProp) => {
    return {
      error: true,
      success: false,
      data: data,
      message: message,
    };
  },
  SuccessResponse: ({ message = "", data }: ResponseProp) => {
    return {
      error: false,
      success: true,
      data: data,
      message: message,
    };
  },
};
