import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'PrescoPad',
  slug: 'PrescoPad',
  extra: {
    ...config.extra,
    // Default to the live Render backend, but allow overrides per-environment.
    backendUrl: process.env.BACKEND_URL || 'https://prescopad-25.onrender.com/api',
    eas: {
      projectId: 'cf59fdd9-7225-45f4-9bdc-7f9b4493b51b',
    },
  },
});
