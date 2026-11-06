import { useEffect, useState } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';

interface UseAppUpdatesOptions {
  checkOnResume?: boolean;
  promptUserToRestart?: boolean;
}

export function useAppUpdates(options: UseAppUpdatesOptions = {}) {
  const { checkOnResume = true, promptUserToRestart = true } = options;
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const checkForUpdate = async () => {
    // Updates are not supported in Expo Go or non-production native debug builds
    if (__DEV__ || !Updates.isEnabled) {
      return false;
    }

    try {
      setIsChecking(true);
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setUpdateAvailable(true);
        setIsDownloading(true);
        await Updates.fetchUpdateAsync();
        setIsDownloading(false);

        if (promptUserToRestart) {
          Alert.alert(
            'Update Available',
            'A new version of MODORMC has been downloaded. Restart the app to apply the update.',
            [
              { text: 'Later', style: 'cancel' },
              {
                text: 'Restart Now',
                style: 'default',
                onPress: async () => {
                  await Updates.reloadAsync();
                },
              },
            ]
          );
        }
        return true;
      }
      return false;
    } catch (error) {
      console.warn('[EAS Update] Error checking for updates:', error);
      return false;
    } finally {
      setIsChecking(false);
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    // Initial check on app startup
    checkForUpdate();

    if (!checkOnResume) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkForUpdate();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [checkOnResume]);

  return {
    isChecking,
    isDownloading,
    updateAvailable,
    checkForUpdate,
    currentlyRunning: Updates.currentlyRunning,
  };
}

