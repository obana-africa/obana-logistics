/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, Button, Input, Select, Alert, Loader } from "@/components/ui";
import { LocationInput } from "@/components/LocationInput";
import { apiClient } from "@/lib/api";
import { Plus, Edit2, Trash2, X, MapPin, Package } from "lucide-react";

interface RouteTemplate {
	id: string;
	origin_city: string;
	destination_city: string;
	transport_mode: string;
	service_level: string;
	weight_brackets: any[];
	metadata: any;
}

export default function RoutesManagement() {
	const [routes, setRoutes] = useState<RouteTemplate[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [showModal, setShowModal] = useState(false);
	const [editingRoute, setEditingRoute] = useState<RouteTemplate | null>(null);
	const [formData, setFormData] = useState<{
		origin: {
			city: string;
			state: string;
			country: string;
			countryCode: string;
		};
		destination: {
			city: string;
			state: string;
			country: string;
			countryCode: string;
		};
		transport_mode: string;
		service_level: string;
		weight_brackets: { min: string; max: string; price: string; eta: string }[];
	}>({
		origin: { city: "", state: "", country: "", countryCode: "" },
		destination: { city: "", state: "", country: "", countryCode: "" },
		transport_mode: "road",
		service_level: "Standard",
		weight_brackets: [],
	});

	useEffect(() => {
		loadRoutes();
	}, []);

	const loadRoutes = async () => {
		try {
			setLoading(true);
			const response = await apiClient.listRoutes();
			setRoutes(response.data || []);
			setError("");
		} catch (err: any) {
			setError(err.response?.data?.message || "Error loading routes");
		} finally {
			setLoading(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		// Validate locations
		if (!formData.origin.city || !formData.destination.city) {
			setError("Please select both origin and destination cities");
			return;
		}

		// Validate and format brackets
		const formattedBrackets = formData.weight_brackets.map((b) => ({
			min: parseFloat(b.min),
			max: parseFloat(b.max),
			price: parseFloat(b.price),
			eta: b.eta,
		}));

		if (
			formattedBrackets.some(
				(b) => isNaN(b.min) || isNaN(b.max) || isNaN(b.price) || !b.eta
			)
		) {
			setError("Please fill all fields in weight brackets correctly");
			return;
		}

		try {
			const payload = {
				origin_city: formData.origin.city,
				destination_city: formData.destination.city,
				transport_mode: formData.transport_mode,
				service_level: formData.service_level,
				weight_brackets: formattedBrackets,
				metadata: {
					origin_state: formData.origin.state,
					origin_country: formData.origin.country,
					destination_state: formData.destination.state,
					destination_country: formData.destination.country,
				},
			};

			if (editingRoute) {
				await apiClient.updateRoute(editingRoute.id, payload);
			} else {
				await apiClient.createRoute(payload);
			}

			await loadRoutes();
			setShowModal(false);
			setEditingRoute(null);
			resetForm();
			setError("");
		} catch (err: any) {
			setError(err.response?.data?.message || "Error saving route");
		}
	};

	const handleEdit = (route: RouteTemplate) => {
		setEditingRoute(route);
		setFormData({
			origin: {
				city: route.origin_city,
				state: route.metadata?.origin_state || "",
				country: route.metadata?.origin_country || "",
				countryCode: route.metadata?.origin_country_code || "",
			},
			destination: {
				city: route.destination_city,
				state: route.metadata?.destination_state || "",
				country: route.metadata?.destination_country || "",
				countryCode: route.metadata?.destination_country_code || "",
			},
			transport_mode: route.transport_mode,
			service_level: route.service_level,
			weight_brackets: Array.isArray(route.weight_brackets)
				? route.weight_brackets.map((b: any) => ({
						min: String(b.min || ""),
						max: String(b.max || ""),
						price: String(b.price || ""),
						eta: b.eta || "",
					}))
				: [],
		});
		setShowModal(true);
	};

	const handleDelete = async (id: string) => {
		if (confirm("Are you sure you want to delete this route?")) {
			try {
				await apiClient.deleteRoute(id);
				await loadRoutes();
				setError("");
			} catch (err: any) {
				setError(err.response?.data?.message || "Error deleting route");
			}
		}
	};

	const resetForm = () => {
		setFormData({
			origin: { city: "", state: "", country: "", countryCode: "" },
			destination: { city: "", state: "", country: "", countryCode: "" },
			transport_mode: "road",
			service_level: "Standard",
			weight_brackets: [],
		});
	};

	const addBracket = () => {
		setFormData({
			...formData,
			weight_brackets: [
				...formData.weight_brackets,
				{ min: "", max: "", price: "", eta: "" },
			],
		});
	};

	const removeBracket = (index: number) => {
		const newBrackets = [...formData.weight_brackets];
		newBrackets.splice(index, 1);
		setFormData({ ...formData, weight_brackets: newBrackets });
	};

	const updateBracket = (index: number, field: string, value: string) => {
		const newBrackets = [...formData.weight_brackets];
		newBrackets[index] = { ...newBrackets[index], [field]: value };
		setFormData({ ...formData, weight_brackets: newBrackets });
	};

	const handleAddNew = () => {
		setEditingRoute(null);
		resetForm();
		setShowModal(true);
	};

	return (
		<DashboardLayout role="admin">
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold text-gray-900">
							Route Templates
						</h1>
						<p className="text-gray-600 mt-1">
							Manage shipping routes and pricing
						</p>
					</div>
					<Button onClick={handleAddNew} variant="primary">
						<Plus className="w-5 h-5 mr-2" />
						New Route
					</Button>
				</div>

				{error && (
					<Alert
						type="error"
						className="cursor-pointer"
						onClick={() => setError("")}
					>
						{error}
					</Alert>
				)}

				{loading ? (
					<div className="flex justify-center py-12">
						<Loader />
					</div>
				) : (
					<Card className="-z-50">
						{routes.length > 0 ? (
							<div className="overflow-x-auto">
								<table className="w-full">
									<thead>
										<tr className="border-b border-gray-200 bg-gray-50">
											<th className="text-left py-4 px-6 font-semibold text-gray-900">
												Route
											</th>
											<th className="text-left py-4 px-6 font-semibold text-gray-900">
												Mode
											</th>
											<th className="text-left py-4 px-6 font-semibold text-gray-900">
												Service
											</th>
											<th className="text-left py-4 px-6 font-semibold text-gray-900">
												Weight Brackets
											</th>
											<th className="text-right py-4 px-6 font-semibold text-gray-900">
												Actions
											</th>
										</tr>
									</thead>
									<tbody>
										{routes.map((route) => (
											<tr
												key={route.id}
												className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
											>
												<td className="py-4 px-6">
													<div className="flex items-center gap-2">
														<MapPin className="h-4 w-4 text-blue-600 shrink-0" />
														<div>
															<p className="font-medium text-gray-900">
																{route.origin_city} → {route.destination_city}
															</p>
															{route.metadata?.origin_country &&
																route.metadata?.destination_country && (
																	<p className="text-xs text-gray-500 mt-0.5">
																		{route.metadata.origin_country} →{" "}
																		{route.metadata.destination_country}
																	</p>
																)}
														</div>
													</div>
												</td>
												<td className="py-4 px-6">
													<span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
														{route.transport_mode}
													</span>
												</td>
												<td className="py-4 px-6">
													<span className="text-sm text-gray-700">
														{route.service_level}
													</span>
												</td>
												<td className="py-4 px-6">
													<div className="relative group">
														<button className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors">
															<Package className="h-4 w-4" />
															{route.weight_brackets?.length || 0} bracket
															{route.weight_brackets?.length !== 1 ? "s" : ""}
														</button>

														{/* Hover Tooltip */}
														<div className="absolute left-0 top-full mt-2 w-80 bg-white border-2 border-gray-200 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-99 p-4">
															<div className="space-y-2">
																<p className="text-xs font-semibold text-gray-600 uppercase mb-3 ">
																	Weight Brackets
																</p>
																{(route.weight_brackets || []).map(
																	(bracket: any, index: number) => (
																		<div
																			key={index}
																			className="bg-gray-50 rounded-lg p-3 border border-gray-200"
																		>
																			<div className="grid grid-cols-2 gap-2 text-sm">
																				<div>
																					<span className="text-gray-600">
																						Weight:
																					</span>
																					<span className="font-semibold text-gray-900 ml-1">
																						{bracket.min}-{bracket.max} kg
																					</span>
																				</div>
																				<div>
																					<span className="text-gray-600">
																						Price:
																					</span>
																					<span className="font-semibold text-green-600 ml-1">
																						₦{bracket.price?.toLocaleString()}
																					</span>
																				</div>
																				<div className="col-span-2">
																					<span className="text-gray-600">
																						ETA:
																					</span>
																					<span className="font-medium text-blue-600 ml-1">
																						{bracket.eta}
																					</span>
																				</div>
																			</div>
																		</div>
																	)
																)}
															</div>
														</div>
													</div>
												</td>
												<td className="py-4 px-6 text-right space-x-2">
													<Button
														onClick={() => handleEdit(route)}
														variant="ghost"
														size="sm"
														className="hover:bg-blue-50 hover:text-blue-700"
													>
														<Edit2 className="w-4 h-4" />
													</Button>
													<Button
														onClick={() => handleDelete(route.id)}
														variant="ghost"
														size="sm"
														className="text-red-600 hover:bg-red-50 hover:text-red-700"
													>
														<Trash2 className="w-4 h-4" />
													</Button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<div className="text-center py-16">
								<div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
									<MapPin className="w-8 h-8 text-gray-400" />
								</div>
								<p className="text-gray-600 mb-4 text-lg">
									No routes created yet
								</p>
								<p className="text-gray-500 text-sm mb-6">
									Create your first route template to start managing shipments
								</p>
								<Button onClick={handleAddNew} variant="primary">
									<Plus className="w-5 h-5 mr-2" />
									Create First Route
								</Button>
							</div>
						)}
					</Card>
				)}

				{/* Modal */}
				{showModal && (
					<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
						<div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
							<div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
								<div>
									<h2 className="text-2xl font-bold text-gray-900">
										{editingRoute ? "Edit Route Template" : "Create New Route"}
									</h2>
									<p className="text-sm text-gray-600 mt-1">
										Define shipping routes with pricing and delivery times
									</p>
								</div>
								<button
									onClick={() => {
										setShowModal(false);
										setEditingRoute(null);
									}}
									className="text-gray-400 hover:text-gray-600 transition-colors"
								>
									<X className="w-6 h-6" />
								</button>
							</div>

							<form onSubmit={handleSubmit} className="p-6 space-y-6">
								{/* Origin & Destination Section */}
								<div className="grid md:grid-cols-2 gap-6">
									{/* Origin Location */}
									<div className="border-2 border-blue-100 rounded-xl p-5 bg-linear-to-br from-blue-50 to-white">
										<h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
											<MapPin className="h-5 w-5 text-blue-600" />
											Origin Location
										</h3>
										<p className="text-sm text-gray-600 mb-4">
											Where does the shipment start?
										</p>

										<LocationInput
											label="Origin"
											value={formData.origin}
											onChange={(location) =>
												setFormData({
													...formData,
													origin: location,
												})
											}
											required
											placeholder="Search for origin city..."
										/>
									</div>

									{/* Destination Location */}
									<div className="border-2 border-green-100 rounded-xl p-5 bg-linear-to-br from-green-50 to-white">
										<h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
											<MapPin className="h-5 w-5 text-green-600" />
											Destination Location
										</h3>
										<p className="text-sm text-gray-600 mb-4">
											Where should it be delivered?
										</p>

										<LocationInput
											label="Destination"
											value={formData.destination}
											onChange={(location) =>
												setFormData({
													...formData,
													destination: location,
												})
											}
											required
											placeholder="Search for destination city..."
										/>
									</div>
								</div>

								{/* Transport & Service Section */}
								<div className="border-2 border-purple-100 rounded-xl p-5 bg-linear-to-br from-purple-50 to-white">
									<h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
										<Package className="h-5 w-5 text-purple-600" />
										Transport Details
									</h3>

									<div className="grid grid-cols-2 gap-4">
										<Select
											label="Transport Mode"
											value={formData.transport_mode}
											onChange={(e) =>
												setFormData({
													...formData,
													transport_mode: e.target.value,
												})
											}
											options={[
												{ value: "road", label: "🚚 Road Transport" },
												{ value: "air", label: "✈️ Air Transport" },
												{ value: "sea", label: "🚢 Sea Transport" },
											]}
										/>

										<Select
											label="Service Level"
											value={formData.service_level}
											onChange={(e) =>
												setFormData({
													...formData,
													service_level: e.target.value,
												})
											}
											options={[
												{ value: "Standard", label: "📦 Standard" },
												{ value: "Express", label: "⚡ Express" },
												{ value: "Economy", label: "🐢 Economy" },
												{
													value: "International Express",
													label: "🌍 International Express",
												},
											]}
										/>
									</div>
								</div>

								{/* Weight Brackets Section */}
								<div className="border-2 border-orange-100 rounded-xl p-5 bg-linear-to-br from-orange-50 to-white">
									<div className="flex items-center justify-between mb-4">
										<div>
											<h3 className="font-semibold text-gray-900 flex items-center gap-2">
												<Package className="h-5 w-5 text-orange-600" />
												Weight Brackets & Pricing
											</h3>
											<p className="text-sm text-gray-600 mt-1">
												Define weight ranges with prices and delivery times
											</p>
										</div>
										<Button
											type="button"
											variant="secondary"
											size="sm"
											onClick={addBracket}
											className="border-2 border-orange-300 hover:bg-orange-50"
										>
											<Plus className="w-4 h-4 mr-1" /> Add Bracket
										</Button>
									</div>

									{formData.weight_brackets.length === 0 && (
										<div className="text-center p-8 border-2 border-dashed border-orange-300 rounded-lg bg-white">
											<Package className="h-12 w-12 text-orange-400 mx-auto mb-3" />
											<p className="text-gray-600 font-medium mb-2">
												No weight brackets defined
											</p>
											<p className="text-sm text-gray-500 mb-4">
												Add weight brackets to set pricing for different package
												weights
											</p>
											<Button
												type="button"
												variant="secondary"
												onClick={addBracket}
												className="border-2 border-orange-300"
											>
												<Plus className="w-4 h-4 mr-1" /> Add First Bracket
											</Button>
										</div>
									)}

									<div className="space-y-3">
										{formData.weight_brackets.map((bracket, index) => (
											<div
												key={index}
												className="bg-white p-4 rounded-lg border-2 border-orange-200"
											>
												<div className="flex items-center justify-between mb-3">
													<span className="text-sm font-semibold text-orange-900">
														Bracket {index + 1}
													</span>
													<Button
														type="button"
														variant="ghost"
														onClick={() => removeBracket(index)}
														className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1"
													>
														<Trash2 className="w-4 h-4" />
													</Button>
												</div>

												<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
													<div>
														<label className="block text-xs font-medium text-gray-700 mb-1">
															Min Weight (kg)
														</label>
														<Input
															placeholder="0"
															type="number"
															step="0.01"
															value={bracket.min}
															onChange={(e) =>
																updateBracket(index, "min", e.target.value)
															}
															required
														/>
													</div>

													<div>
														<label className="block text-xs font-medium text-gray-700 mb-1">
															Max Weight (kg)
														</label>
														<Input
															placeholder="10"
															type="number"
															step="0.01"
															value={bracket.max}
															onChange={(e) =>
																updateBracket(index, "max", e.target.value)
															}
															required
														/>
													</div>

													<div>
														<label className="block text-xs font-medium text-gray-700 mb-1">
															Price (₦)
														</label>
														<Input
															placeholder="5000"
															type="number"
															step="0.01"
															value={bracket.price}
															onChange={(e) =>
																updateBracket(index, "price", e.target.value)
															}
															required
														/>
													</div>

													<div>
														<div className="relative top-5">
															<Input
																placeholder="2 - 3"
																value={bracket.eta.replace(" days", "")}
																onChange={(e) =>
																	updateBracket(
																		index,
																		"eta",
																		`${e.target.value} days`
																	)
																}
																required
															/>
															<span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
																days
															</span>
														</div>
													</div>
												</div>

												{/* Preview */}
												<div className="mt-3 p-2 bg-orange-50 rounded text-xs text-gray-600">
													<strong>Preview:</strong> Packages weighing{" "}
													{bracket.min || "0"} - {bracket.max || "∞"} kg will
													cost{" "}
													<strong className="text-green-600">
														₦{bracket.price || "0"}
													</strong>{" "}
													with delivery in{" "}
													<strong className="text-blue-600">
														{bracket.eta || "N/A"}
													</strong>
												</div>
											</div>
										))}
									</div>
								</div>

								{/* Action Buttons */}
								<div className="flex gap-3 pt-4 border-t border-gray-200">
									<Button
										type="button"
										onClick={() => {
											setShowModal(false);
											setEditingRoute(null);
										}}
										fullWidth
										variant="secondary"
									>
										Cancel
									</Button>
									<Button
										type="submit"
										fullWidth
										variant="primary"
										className="py-3!"
									>
										{editingRoute ? "✓ Update Route" : "✓ Create Route"}
									</Button>
								</div>
							</form>
						</div>
					</div>
				)}
			</div>
		</DashboardLayout>
	);
}