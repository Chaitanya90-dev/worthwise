import { Button, Stack } from '@mantine/core';
import { Plus } from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { ModuleHeader } from '../components/common/ModuleHeader';

export function AccountsPage() {
  return (
    <Stack gap="lg">
      <ModuleHeader
        title="Accounts"
        description="Track bank accounts, cash, credit cards, loans, and investment accounts."
        actions={
          <Button leftSection={<Plus size={16} />} disabled>
            Add account
          </Button>
        }
      />
      <EmptyState
        title="No accounts yet"
        message="Accounts will anchor transactions, repayments, balances, and payment sources."
      />
    </Stack>
  );
}

