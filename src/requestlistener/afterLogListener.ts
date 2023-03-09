import { RequestListener } from "webdav-server/lib/server/v2/webDAVServer/BeforeAfter";

export const afterLogListener: RequestListener = (arg, next) => {
    // display some logs if required by the configuration.
    const debugAfterRequest = process.env.LOG_AFTER_REQUEST;
    switch (debugAfterRequest) {
        case '1':
            // Display the method, the URI, the returned status code and the returned message
            console.log('>>', arg.request.method, arg.requested.uri, '>', arg.response.statusCode, arg.response.statusMessage);
            break;

        case '2':
            // Display the method, the URI, the returned status code and the returned message
            console.log('>>', arg.request.method, arg.requested.uri, '>', arg.response.statusCode, arg.response.statusMessage);   
            // If available, display the body of the response
            console.log(arg.responseBody ? arg.responseBody : 'no response body');  
            break;
    }

    next();
};