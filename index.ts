import { registerRootComponent } from 'expo';
import { Alert } from 'react-native';
import App from './App';

// Global error handler — catches ALL unhandled JS errors including native crashes
const originalHandler = (ErrorUtils as any).getGlobalHandler();
(ErrorUtils as any).setGlobalHandler((error: any, isFatal: boolean) => {
  Alert.alert(
    isFatal ? '💥 Fatal Crash' : '⚠️ Error',
    `${error?.message ?? String(error)}\n\n${error?.stack?.slice(0, 400) ?? ''}`,
    [{ text: 'OK' }]
  );
  originalHandler(error, isFatal);
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
registerRootComponent(App);
