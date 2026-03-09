/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuthStore } from "./authStore";
import { apiClient } from "./api";

interface AuthContextType {
	user: any | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	error: string | null;
	signup: (
		first_name: string,
		last_name: string,
		email: string,
		phone: string,
		password: string,
		role: string,
		additionalData?: any
	) => Promise<any>;
	login: (
		userIdentification: string,
		password: string,
		rememberMe?: boolean
	) => Promise<any>;
	logout: () => Promise<void>;
	clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const store = useAuthStore();
	const [error, setError] = useState<string | null>(null);
	const signup = async (
		first_name: string,
		last_name: string,
		email: string,
		phone: string,
		password: string,
		role: string
	) => {
		try {
			setError(null);
			const response = await apiClient.signup(
				first_name,
				last_name,
				email,
				phone,
				password,
				role,
				// additionalData
			);
			const authResponse = response.data;
			if ((authResponse.success || authResponse.status === 'success') && authResponse.data) {
				const { user, access_token, refresh_token } = authResponse.data;
				store.setUser(user);
				store.setAccessToken(access_token);
				store.setAuthenticated(true);

				if (typeof window !== "undefined" && refresh_token) {
					localStorage.setItem("refresh_token", refresh_token);
				}
			}
			return authResponse;
		} catch (err: any) {
			const errorMsg =
				err.response?.data?.message || err.message || "Signup failed";
			setError(errorMsg);
			throw err;
		}
	};

	const login = async (
		userIdentification: string,
		password: string,
		rememberMe: boolean = false
	) => {
		try {
			setError(null);
			const response = await apiClient.login(
				userIdentification,
				password,
				rememberMe
			);
			const authResponse = response.data;
			if ((authResponse.success || authResponse.status === 'success') && authResponse.data) {
				const { user, access_token, refresh_token } = authResponse.data;
				store.setUser(user);
				store.setAccessToken(access_token);
				store.setAuthenticated(true);
				
				if (typeof window !== "undefined") {
					if (refresh_token) {
						localStorage.setItem("refresh_token", refresh_token);
					}
				}
			}
			return authResponse;
		} catch (err: any) {
			const errorMsg =
				err.response?.data?.message || err.message || "Login failed";
			setError(errorMsg);
			throw err;
		}
	};


	const logout = async () => {
		try {
			if (typeof window !== "undefined") {
				await apiClient.logout(localStorage.getItem("refresh_token"));
			}
			store.logout();
			setError(null);
		} catch (err: unknown) {
			console.error("Logout error:", err);
		}
	};

	const clearError = () => setError(null);

	return (
		<AuthContext.Provider
			value={{
				user: store.user,
				isAuthenticated: store.isAuthenticated,
				isLoading: store.isLoading,
				error: error || store.error,
				signup,
				login,
				logout,
				clearError,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within AuthProvider");
	}
	return context;
}
