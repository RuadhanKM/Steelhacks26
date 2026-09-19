import '@firebase/auth';

declare module '@firebase/auth' {

  interface ReactNativeStorage {
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
    setItem(key: string, value: string): Promise<void>;
  }

  export function getReactNativePersistence(storage: ReactNativeStorage): Persistence;
}
