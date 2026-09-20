import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppLogo } from '@/components/ui/AppLogo';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, error: authError, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setFormError('Enter your email and password.');
      return;
    }

    setFormError(null);
    clearError();
    setIsSubmitting(true);
    try {
      await signIn(normalizedEmail, password);
      router.replace('/');
    } catch {
      // AuthContext exposes the user-facing error.
    } finally {
      setIsSubmitting(false);
    }
  };

  const error = formError ?? authError;

  return (
    <SafeAreaView
      className="flex-1 bg-chase-bg"
      edges={["top", "bottom", "left", "right"]}
      style={{ flex: 1, width: "100%", minHeight: "100%" }}
    >
      {/* Top logo bar — sits safely below the iPhone notch */}
      <View className="w-full items-center pt-2 pb-1">
        <AppLogo size={38} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 24,
            paddingVertical: 16,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            className="w-full bg-white border border-chase-border rounded-3xl p-6"
            style={{ maxWidth: 480 }}
          >
            <Text className="text-3xl font-bold text-chase-textPrimary">Welcome back</Text>
            <Text className="mt-2 text-base text-chase-textSecondary">
              Sign in to securely access Pyre.
            </Text>

            <TextInput
              className="mt-8 h-[52px] rounded-xl border border-chase-border px-4 text-[16px] text-chase-textPrimary"
              placeholder="Email address"
              placeholderTextColor="#A79CAF"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              style={{ textAlignVertical: 'center' }}
            />
            <TextInput
              className="mt-3 h-[52px] rounded-xl border border-chase-border px-4 text-[16px] text-chase-textPrimary"
              placeholder="Password"
              placeholderTextColor="#A79CAF"
              autoCapitalize="none"
              autoComplete="password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleSubmit}
              style={{ textAlignVertical: 'center' }}
            />

            {error && <Text className="mt-3 text-sm text-red-700">{error}</Text>}

            <Pressable
              className="mt-6 h-12 items-center justify-center rounded-xl bg-chase-blue active:bg-chase-purple600"
              disabled={isSubmitting}
              onPress={handleSubmit}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-base font-semibold text-white">Sign in</Text>
              )}
            </Pressable>

            <View className="mt-5 flex-row justify-center">
              <Text className="text-sm text-chase-textSecondary">New here? </Text>
              <Link href="/signup">
                <Text className="text-sm font-semibold text-chase-blue">Create an account</Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
