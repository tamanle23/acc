import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PayOsQrModal } from './payos-qr-modal';
import * as billingApi from '../../api/use-billing';

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('PayOsQrModal Component', () => {
  it('renders payment order details and dynamic QR code when data is loaded', () => {
    vi.spyOn(billingApi, 'useCreatePaymentLink').mockReturnValue({
      mutate: vi.fn(),
      data: {
        orderCode: 1728569999000,
        amount: 199000,
        description: 'UNIPOST PRO MONTHLY',
        checkoutUrl: 'https://pay.payos.vn/web/1728569999000',
        qrCode: '00020101021238540010A00000072701240006970422011003456789100208QRIBFTTA',
        status: 'PENDING',
      },
      isPending: false,
    } as any);

    vi.spyOn(billingApi, 'useSimulatePaymentWebhook').mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(true),
      isPending: false,
    } as any);

    renderWithQueryClient(
      <PayOsQrModal
        isOpen={true}
        onClose={vi.fn()}
        planTier="PRO"
        featureTitle="Schema Architect Studio"
      />
    );

    expect(screen.getByText('Thanh toán Quét mã VietQR')).toBeDefined();
    expect(screen.getByText('199,000 VND')).toBeDefined();
    expect(screen.getByText(/Nội dung CK: UNIPOST PRO MONTHLY/i)).toBeDefined();
    expect(screen.getByText('Xác nhận đã chuyển khoản (Mô phỏng Webhook 0s)')).toBeDefined();
  });

  it('triggers webhook simulation and switches to success celebration screen', async () => {
    const mockSimulate = vi.fn().mockResolvedValue(true);
    const mockSuccess = vi.fn();

    vi.spyOn(billingApi, 'useCreatePaymentLink').mockReturnValue({
      mutate: vi.fn(),
      data: {
        orderCode: 1728569999000,
        amount: 199000,
        description: 'UNIPOST PRO MONTHLY',
        checkoutUrl: 'https://pay.payos.vn/web/1728569999000',
        qrCode: '00020101021238540010A00000072701240006970422011003456789100208QRIBFTTA',
        status: 'PENDING',
      },
      isPending: false,
    } as any);

    vi.spyOn(billingApi, 'useSimulatePaymentWebhook').mockReturnValue({
      mutateAsync: mockSimulate,
      isPending: false,
    } as any);

    renderWithQueryClient(
      <PayOsQrModal
        isOpen={true}
        onClose={vi.fn()}
        planTier="PRO"
        onSuccess={mockSuccess}
      />
    );

    const payBtn = screen.getByText('Xác nhận đã chuyển khoản (Mô phỏng Webhook 0s)');
    fireEvent.click(payBtn);

    await waitFor(() => {
      expect(mockSimulate).toHaveBeenCalledWith({
        orderCode: 1728569999000,
        amount: 199000,
        planTier: 'PRO',
      });
      expect(mockSuccess).toHaveBeenCalled();
      expect(screen.getByText('Thanh Toán Hoàn Tất!')).toBeDefined();
    });
  });
});
