import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import type { AppUsage } from './appUsage';

const native = requireOptionalNativeModule<AppUsage & { isSimulator?: boolean }>('TodoAppUsage');

const [major, minor = 0] = String(Platform.Version).split('.').map(Number);

export const appUsage = (major > 17 || (major === 17 && minor >= 4)) &&
  typeof native?.configure === 'function' && typeof native.sync === 'function' ? native : null;

export const appUsagePreview = native?.isSimulator === true;
