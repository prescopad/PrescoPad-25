import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'PrescoPad',
  slug: 'PrescoPad',
  extra: {
    ...config.extra,
    // Only set backendUrl when BACKEND_URL is explicitly provided (e.g. EAS
    // production builds). Leaving it undefined in dev lets config.ts
    // auto-detect the local backend from the Expo dev-server host, so the app
    // talks to your machine's localhost:3000 instead of Render.
    backendUrl: process.env.BACKEND_URL || undefined,
    eas: {
      projectId: 'cf59fdd9-7225-45f4-9bdc-7f9b4493b51b',
    },
  },
});
