import { getReactNativePersistence } from '@firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const firebasePersistence = getReactNativePersistence(AsyncStorage);
