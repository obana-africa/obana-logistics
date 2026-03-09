'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Loader, Button } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { UserPlus } from 'lucide-react';
import Link from 'next/link';
import AgentListTable from "@/components/AgentListTable";

export interface Agent {
  id: number;
  agent_code: string;
  verification_status: 'pending' | 'verified' | 'failed';
  status: 'pending_verification' | 'active' | 'suspended' | 'deactivated';
  createdAt: string;
  user: {
    id: number;
    email: string;
    phone: string;
    first_name: string;
    last_name: string;
  };
}

export default function ManageAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.listAgents();
      if (response.status === 'success') {
        setAgents(response.data);
      } else {
        setError(response.message || 'Failed to fetch agents.');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleDelete = async (agentId: number) => {
    if (window.confirm('Are you sure you want to delete this agent profile? The user will remain but their agent status will be removed.')) {
      try {
        await apiClient.deleteAgent(agentId.toString());
        fetchAgents(); // Refresh the list
      } catch (error) {
        console.error('Failed to delete agent:', error);
        alert('Failed to delete agent. Please try again.');
      }
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Agent Management</h1>
            <p className="text-gray-600 mt-2">View, manage, and verify agents.</p>
          </div>
        </div>

        <Card>
          {loading && <div className="flex justify-center py-12"><Loader /></div>}
          {error && <div className="text-center py-12 text-red-500">{error}</div>}
          {!loading && !error && <AgentListTable agents={agents} onDelete={handleDelete} />}
        </Card>
      </div>
    </DashboardLayout>
  );
}