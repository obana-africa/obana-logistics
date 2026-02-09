"use client";

import React from "react";
import Link from "next/link";
import {  Facebook, Twitter, Instagram, Linkedin } from "lucide-react";
import Image from "next/image";

export default function Footer() {
	return (
		<footer className="bg-slate-950 text-white pt-64 pb-16 relative ">
			{/* This padding-top creates space for the overlapping contact form */}
			<div className="max-w-7xl mx-auto px-6">
				<div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
					<div className="text-center mb-8">
						<Link
							href="/"
							className="flex items-center justify-center bg-[#f4f4f4] rounded-lg "
						>
							<Image
								src="/logo.svg"
								alt="Obana Logistics Logo"
								width={100}
								height={100}
								className="ml-2"
							/>
						</Link>
						<p className="text-blue-200 text-lg font-medium">
							Logistics Made Simple
						</p>
					</div>

					<div>
						<h4 className="font-bold mb-4">Services</h4>
						<ul className="space-y-2 text-slate-400">
							<li>
								<Link
									href="#"
									className="hover:text-amber-400 transition-colors"
								>
									Express Delivery
								</Link>
							</li>
							<li>
								<Link
									href="#"
									className="hover:text-amber-400 transition-colors"
								>
									Interstate Shipping
								</Link>
							</li>
							<li>
								<Link
									href="#"
									className="hover:text-amber-400 transition-colors"
								>
									Business Solutions
								</Link>
							</li>
							<li>
								<Link
									href="#"
									className="hover:text-amber-400 transition-colors"
								>
									Track Package
								</Link>
							</li>
						</ul>
					</div>

					<div>
						<h4 className="font-bold mb-4">Company</h4>
						<ul className="space-y-2 text-slate-400">
							<li>
								<Link
									href="#"
									className="hover:text-amber-400 transition-colors"
								>
									About Us
								</Link>
							</li>
							<li>
								<Link
									href="#"
									className="hover:text-amber-400 transition-colors"
								>
									Careers
								</Link>
							</li>
							<li>
								<Link
									href="#"
									className="hover:text-amber-400 transition-colors"
								>
									Blog
								</Link>
							</li>
							<li>
								<Link
									href="#"
									className="hover:text-amber-400 transition-colors"
								>
									Contact
								</Link>
							</li>
						</ul>
					</div>

					<div>
						<h4 className="font-bold mb-4">Legal</h4>
						<ul className="space-y-2 text-slate-400">
							<li>
								<Link
									href="#"
									className="hover:text-amber-400 transition-colors"
								>
									Privacy Policy
								</Link>
							</li>
							<li>
								<Link
									href="#"
									className="hover:text-amber-400 transition-colors"
								>
									Terms of Service
								</Link>
							</li>
							<li>
								<Link
									href="#"
									className="hover:text-amber-400 transition-colors"
								>
									Shipping Policy
								</Link>
							</li>
							<li>
								<Link
									href="#"
									className="hover:text-amber-400 transition-colors"
								>
									Refund Policy
								</Link>
							</li>
						</ul>
					</div>
				</div>

				{/* Social Media & Copyright */}
				<div className="border-t border-slate-800 pt-8">
					<div className="flex flex-col md:flex-row justify-between items-center gap-6">
						<p className="text-slate-400 text-sm">
							&copy; 2026 Obana Logistics. All rights reserved.
						</p>

						{/* Social Links */}
						<div className="flex items-center gap-4">
							<Link
								href="https://facebook.com"
								target="_blank"
								rel="noopener noreferrer"
								className="w-10 h-10 bg-slate-800 hover:bg-blue-600 rounded-full flex items-center justify-center transition-all hover:scale-110"
							>
								<Facebook className="w-5 h-5" />
							</Link>
							<Link
								href="https://twitter.com"
								target="_blank"
								rel="noopener noreferrer"
								className="w-10 h-10 bg-slate-800 hover:bg-sky-500 rounded-full flex items-center justify-center transition-all hover:scale-110"
							>
								<Twitter className="w-5 h-5" />
							</Link>
							<Link
								href="https://instagram.com"
								target="_blank"
								rel="noopener noreferrer"
								className="w-10 h-10 bg-slate-800 hover:bg-pink-600 rounded-full flex items-center justify-center transition-all hover:scale-110"
							>
								<Instagram className="w-5 h-5" />
							</Link>
							<Link
								href="https://linkedin.com"
								target="_blank"
								rel="noopener noreferrer"
								className="w-10 h-10 bg-slate-800 hover:bg-blue-700 rounded-full flex items-center justify-center transition-all hover:scale-110"
							>
								<Linkedin className="w-5 h-5" />
							</Link>
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
}
