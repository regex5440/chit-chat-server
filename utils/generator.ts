type ResponseProp = {
  message?: string;
  data?: any;
};

export const ErrorResponse = ({ message = "", data }: ResponseProp) => {
  return {
    error: true,
    success: false,
    data: data,
    message: message,
  };
};
export const SuccessResponse = ({ message = "", data }: ResponseProp) => {
  return {
    error: false,
    success: true,
    data: data,
    message: message,
  };
};
