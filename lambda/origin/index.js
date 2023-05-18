exports.handler = async function(event) {
  console.log(event);
  var response = {
    'requestid' : event.headers['X-Amz-Cf-Id'],
    'ip' : event.headers['CloudFront-Viewer-Address'],
    'country' : event.headers['CloudFront-Viewer-Country-Name']
  };

  
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body:  JSON.stringify(response),
  };
};
