module.exports = {
    ErrorResponse: ({ message = "", data }) => {
        return {
            error: true,
            success: false,
            data: data,
            message: message,
        };
    },
    SuccessResponse: ({ message = "", data }) => {
        return {
            error: false,
            success: true,
            data: data,
            message: message,
        };
    },
};
