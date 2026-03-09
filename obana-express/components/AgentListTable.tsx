'use client';

import React from 'react';
import { 
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Badge,
    BadgeProps,
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui';
import { MoreHorizontal, Eye, Trash2 } from 'lucide-react';
import { Agent } from '@/app/dashboard/admin/agents/page';
import Link from 'next/link';

interface AgentListTableProps {
  agents: Agent[];
  onDelete: (agentId: number) => void;
}

const getStatusVariant = (status: string): BadgeProps['variant'] => {
  switch (status) {
    case 'verified':
    case 'active':
      return 'success';
    case 'pending':
    case 'pending_verification':
      return 'warning';
    case 'failed':
    case 'suspended':
    case 'deactivated':
      return 'error';
    default:
      return 'default';
  }
};

export default function AgentListTable({ agents, onDelete }: AgentListTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Verification</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Joined</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {agents.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center h-24">
              No agents found.
            </TableCell>
          </TableRow>
        ) : (
          agents.map((agent) => (
            <TableRow key={agent.id}>
              <TableCell>
                <div className="font-medium">{`${agent.user.first_name || ''} ${agent.user.last_name || ''}`.trim() || 'N/A'}</div>
                <div className="text-sm text-muted-foreground">{agent.agent_code}</div>
              </TableCell>
              <TableCell>
                <div>{agent.user.email}</div>
                <div className="text-sm text-muted-foreground">{agent.user.phone}</div>
              </TableCell>
              <TableCell>
                <Badge variant={getStatusVariant(agent.verification_status)}>{agent.verification_status}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={getStatusVariant(agent.status)}>{agent.status}</Badge>
              </TableCell>
              <TableCell>{new Date(agent.createdAt).toLocaleDateString()}</TableCell>
              <TableCell className=' hover:cursor-pointer '>
                {/* View Details */}
                <DropdownMenu>
                  
                  <DropdownMenuTrigger asChild><Button variant="secondary" className="h-8 w-12 p-0">view</Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <Link href={`/dashboard/admin/agents/${agent.id}`} passHref>
                      <DropdownMenuItem><Eye className="mr-2 h-4 w-4" />View/Edit</DropdownMenuItem>
                    </Link>
                    <DropdownMenuItem onClick={() => onDelete(agent.id)} className="text-red-600 focus:text-red-500 focus:bg-red-50">
                      <Trash2 className="mr-2 h-4 w-4" />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}