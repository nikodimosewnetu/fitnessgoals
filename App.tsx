// Entry point for Expo Router
import 'expo-router/entry';
import { useEffect } from 'react';
import { supabase } from './utils/supabase';

function GlobalSupabasePing() {
	useEffect(() => {
		// Initial ping on app start
		supabase.functions.invoke('aicoach', { body: JSON.stringify({ text: 'ping' }) });
		// Periodic ping every 2 minutes
		const pingInterval = setInterval(() => {
			supabase.functions.invoke('aicoach', { body: JSON.stringify({ text: 'ping' }) });
		}, 120000);
		return () => clearInterval(pingInterval);
	}, []);
	return null;
}

export default function App() {
	return <><GlobalSupabasePing /></>;
}
