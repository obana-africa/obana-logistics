'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Loader, Button, Input, Label, SelectP, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { Agent } from '../page'
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

type AgentDetail = Agent & {
  government_id_type?: string;
  government_id_number?: string;
  government_id_image?: string;
  profile_photo?: string;
  country?: string;
  state?: string;
  city?: string;
  lga?: string;
  assigned_zone?: string;
};

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      apiClient.getAgent(id)
        .then(response => {
          if (response.status === 'success') setAgent(response.data);
          else setError(response.message || 'Failed to fetch agent details.');
        })
        .catch(err => {
          setError('An unexpected error occurred.');
          console.error(err);
        })
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleSelectChange = (name: string, value: string) => {
    if (!agent) return;
    setAgent({ ...agent, [name]: value });
  };

  const handleSaveChanges = async () => {
    if (!agent) return;
    setSaving(true);
    try {
      const { id, user, ...updateData } = agent;
      const response = await apiClient.updateAgent(id.toString(), updateData);
      if (response.status === 'success') {
        alert('Agent updated successfully!');
        router.push('/dashboard/admin/agents');
      } else {
        alert(response.message || 'Failed to update agent.');
      }
    } catch (err) {
      alert('An error occurred while saving.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <DashboardLayout role="admin"><div className="flex justify-center py-24"><Loader /></div></DashboardLayout>;
  }

  if (error || !agent) {
    return <DashboardLayout role="admin"><div className="text-center py-24 text-red-500">{error || 'Agent not found.'}</div></DashboardLayout>;
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <Link href="/dashboard/admin/agents" className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Agents
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Edit Agent: {agent.agent_code}</h1>
        </div>

        <Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
            <div>
              <Label htmlFor="verification_status">Verification Status</Label>
              <SelectP name="verification_status" value={agent.verification_status} onValueChange={(value) => handleSelectChange('verification_status', value)}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </SelectP>
            </div>

            <div>
              <Label htmlFor="status">Account Status</Label>
              <SelectP name="status" value={agent.status} onValueChange={(value) => handleSelectChange('status', value)}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending_verification">Pending Verification</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="deactivated">Deactivated</SelectItem>
                </SelectContent>
              </SelectP>
            </div>

            <div><Label htmlFor="city">City</Label><Input id="city" name="city" value={agent.city || ''} disabled /></div>
            <div><Label htmlFor="state">State</Label><Input id="state" name="state" value={agent.state || ''} disabled /></div>

            <div className="md:col-span-2">
              <h3 className="font-medium mb-2">Documents</h3>
              <div className="space-y-2">
                {agent.profile_photo ? (
                  <a href={agent.profile_photo} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View Profile Photo</a>
                ) : <p className="text-sm text-gray-500">No profile photo uploaded.</p>}
                
                {agent.government_id_image ? (
                  <div className="block mt-2">
                    <a href={agent.government_id_image} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View Government ID</a>
                  </div>
                ) : <p className="text-sm text-gray-500">No government ID uploaded.</p>}
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-6 py-4 flex justify-end">
            <Button onClick={handleSaveChanges} disabled={saving}>
              {saving ? <Loader size="sm" className="mr-2" /> : null}
              Save Changes
            </Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}