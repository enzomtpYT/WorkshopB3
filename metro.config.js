const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  transformer: {
    babelTransformerPath: require.resolve('react-native-css-transformer')
  },
  resolver: {
    sourceExts: ['jsx', 'js', 'ts', 'tsx', 'css'] // Ajouter 'css' aux extensions
  }
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);