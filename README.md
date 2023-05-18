# SPA with cross domain API protection using AWS WAF Advanced threat mitigation

## Working SPA with same domain

Steps to deploy the solution:

```
git clone https://github.com/achrafsouk/spa-cross-domain-bot-control.git
cd spa-cross-domain-bot-control
npm install
npm run build
cdk bootstrap
cdk deploy 
```

It deploys a CloudFront distribution, associated to a WAF WebACL configured with Bot Control, and having  two origins:
* /api/* cache behavior -> API Gateway (regional endpoint). Caching disabled.
* default cache behavior -> S3 bucket with the HTML of the SPA. Caching enabled.

The SPA HTML includes the Bot Control SDK, and a button that makes a call to an API. If WAF detects bad signals on the API call, the SPA triggers a CAPTCHA in the HTML. To test this behavior, change the user agent header in the browser.

## Making changes to the solution to demonstrate cross domain configurations

Update the architecture:
* Create a second CloudFront distribution that is pointing to API Gateway.
* Change the SPA HTML to make request directly to the domain of the second CloudFront distribution
* Dissociate the WAF WebACL from the first distribution, and associate it with the second one.

Make the following changes to make it work:
* Configure token domain of AWS WAF, to inlude the domain of the first CloudFront distribution
* Change the HTML to include the WAF token in a specific header when making calles to the API (Cookies are not sent cross domains).
* Configure CORS on APIG including preflight requests
* Add a rule to WAF WebACL in the beginning that allows OPTIONS preflight requests.


## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.