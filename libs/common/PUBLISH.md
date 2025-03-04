# Publishing Instructions for @bitsacco/common

While we recommend using the GitHub Actions workflow for publishing, you can also publish manually following these steps:

## Prerequisites

1. Ensure you have npm account with access to the @bitsacco organization
2. Make sure you have your npm authentication set up locally

## Publishing Steps

1. Run the packaging script:

   ```bash
   cd libs/common
   ./package.sh
   ```

2. Navigate to the package directory:

   ```bash
   cd npm-package
   ```

3. Login to npm (if not already logged in):

   ```bash
   npm login
   ```

4. Publish the package:

   ```bash
   npm publish --access public
   ```

   If two-factor authentication is enabled, use:

   ```bash
   npm publish --access public --otp=YOUR_OTP_CODE
   ```

   Replace YOUR_OTP_CODE with the code from your authenticator app.

## Updating the Version

Before publishing a new version, you should update the version in the package.json file in the libs/common directory. You can do this manually or use:

```bash
cd libs/common
npm version patch # or minor or major
```

This will update the version in your package.json file. Then run the package.sh script to create a new package with the updated version.

## After Publishing

After successfully publishing, consider:

1. Creating a git tag to mark the version:

   ```bash
   git tag common-v[version]
   git push origin common-v[version]
   ```

2. Creating a GitHub release with release notes
