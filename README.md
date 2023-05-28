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

## Working SPA with cross domain

Deploy the update the solution using this command line:

```
cdk deploy -c CROSS_DOMAIN_ENABLED=true
```

The architecture is updated this way:
* CloudFront distribution 1 -> S3 bucket with the HTML of the SPA. Caching enabled. 
* CloudFront distribution 2 -> API Gateway (regional endpoint). Caching disabled. WAF enabled.


## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.