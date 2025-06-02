const webpack = require('webpack');

module.exports = (options, webpack) => {
  return {
    ...options,
    externals: {
      // Mark optional microservices dependencies as external
      'kafkajs': 'commonjs2 kafkajs',
      'mqtt': 'commonjs2 mqtt',
      'nats': 'commonjs2 nats',
      'amqplib': 'commonjs2 amqplib',
      'amqp-connection-manager': 'commonjs2 amqp-connection-manager',
    },
    plugins: [
      ...options.plugins,
      // Ignore optional dependencies that we don't use
      new webpack.IgnorePlugin({
        checkResource(resource, context) {
          const lazyImports = [
            'kafkajs',
            'mqtt',
            'nats', 
            'amqplib',
            'amqp-connection-manager',
            '@mikro-orm/core',
            '@nestjs/typeorm/dist/common/typeorm.utils',
            'sequelize',
          ];
          
          // Ignore terminus utils completely to avoid parsing issues
          if (context && context.includes('@nestjs/terminus')) {
            if (resource.includes('utils/') || 
                resource.includes('.d.ts') || 
                resource.includes('.map') ||
                resource.includes('checkPackage') ||
                resource.includes('is-error') ||
                resource.includes('promise-timeout') ||
                resource.includes('sleep') ||
                resource.includes('types')) {
              return true;
            }
          }
          
          return lazyImports.includes(resource);
        },
      }),
    ],
  };
};