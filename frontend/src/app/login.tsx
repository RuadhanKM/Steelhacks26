import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
      className="flex-1 bg-chase-bg justify-center px-6"
      style={{ flex: 1, width: "100%", minHeight: "100%" }}
    >
      <View
        className="bg-white border border-chase-border rounded-3xl p-6"
        style={{ width: "100%", maxWidth: 480, alignSelf: "center" }}
      >
        <Text className="text-3xl font-bold text-chase-textPrimary">Welcome back</Text>
        <Text className="mt-2 text-base text-chase-textSecondary">
          Sign in to securely access your banking assistant.
        </Text>

        <TextInput
          className="mt-8 rounded-xl border border-chase-border px-4 py-3 text-base text-chase-textPrimary"
          placeholder="Email address"
          placeholderTextColor="#A79CAF"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          className="mt-3 rounded-xl border border-chase-border px-4 py-3 text-base text-chase-textPrimary"
          placeholder="Password"
          placeholderTextColor="#A79CAF"
          autoCapitalize="none"
          autoComplete="password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={handleSubmit}
        />

        {error && <Text className="mt-3 text-sm text-red-700">{error}</Text>}

        <Pressable
          className="mt-6 h-12 items-center justify-center rounded-xl bg-chase-blue"
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
    </SafeAreaView>
  );
}
