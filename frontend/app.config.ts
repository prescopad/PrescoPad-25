import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'PrescoPad',
  slug: 'PrescoPad',
  extra: {
    ...config.extra,
    // Set your deployed backend URL here (e.g. https://prescopad-api.onrender.com/api)
    // When empty, dev mode auto-detects LAN IP; production will require this to be set
    backendUrl: process.env.BACKEND_URL || '',
    eas: {
      projectId: 'cf59fdd9-7225-45f4-9bdc-7f9b4493b51b',
    },
  },
});
