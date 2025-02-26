#!/bin/bash
set -e

echo "Building @bitsacco/common npm package"

# Step 1: Clean output directory
PACKAGE_DIR="npm-package"
rm -rf $PACKAGE_DIR
mkdir -p $PACKAGE_DIR

# Step 2: Copy package.json, README.md, LICENSE
cp package.json $PACKAGE_DIR/
cp README.md $PACKAGE_DIR/
cp ../../LICENSE $PACKAGE_DIR/

# Step 3: Update the package.json
sed -i 's/"main": ".*"/"main": "index.js"/' $PACKAGE_DIR/package.json
sed -i 's/"types": ".*"/"types": "index.d.ts"/' $PACKAGE_DIR/package.json
# Remove scripts
sed -i 's/"scripts": {.*},/"scripts": {},/' $PACKAGE_DIR/package.json

# Step 4: Build using NestJS compiler
cd ../..
rm -rf dist/libs/common
node_modules/.bin/nest build common

# Step 5: Copy the build output
cp -r dist/libs/common/* libs/common/$PACKAGE_DIR/

# Step 6: Add type declarations 
cd libs/common
echo "// Type definitions for @bitsacco/common" > $PACKAGE_DIR/index.d.ts
echo "export * from './src';" >> $PACKAGE_DIR/index.d.ts

# Step 7: Create a README for publishing
cat > PUBLISH.md << EOF
# Publishing @bitsacco/common

The package is ready to be published. To publish:

1. Navigate to the npm-package directory:
   \`\`\`
   cd npm-package
   \`\`\`

2. Login to npm (if not already logged in):
   \`\`\`
   npm login
   \`\`\`

3. Publish the package:
   \`\`\`
   npm publish
   \`\`\`

   If two-factor authentication is enabled, use:
   \`\`\`
   npm publish --otp=YOUR_OTP_CODE
   \`\`\`
   
   Replace YOUR_OTP_CODE with the code from your authenticator app.

EOF

echo "Package is ready in the '$PACKAGE_DIR' directory"
echo "See PUBLISH.md for publishing instructions"