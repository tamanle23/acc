package com.acc.sandbox.aspect;

import com.acc.sandbox.simulators.PayOsSimulator;
import com.acc.tenant.billing.dto.CheckoutResponseDto;
import com.acc.tenant.billing.dto.CreatePaymentLinkRequest;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Aspect that intercepts PayOsBillingService.createPaymentLink when sandbox is enabled,
 * automatically registering the simulated checkout order in PayOsSimulator and triggering
 * the scheduled or instant payment confirmation webhook.
 */
@Aspect
@Component
@ConditionalOnProperty(prefix = "application.sandbox", name = "enabled", havingValue = "true")
public class PayOsCheckoutInterceptorAspect {

    private static final Logger log = LoggerFactory.getLogger(PayOsCheckoutInterceptorAspect.class);

    private final PayOsSimulator payOsSimulator;

    public PayOsCheckoutInterceptorAspect(PayOsSimulator payOsSimulator) {
        this.payOsSimulator = payOsSimulator;
    }

    @AfterReturning(
            pointcut = "execution(* com.acc.tenant.billing.PayOsBillingService.createPaymentLink(..)) && args(request)",
            returning = "checkout",
            argNames = "request,checkout"
    )
    public void interceptCheckout(CreatePaymentLinkRequest request, CheckoutResponseDto checkout) {
        if (checkout == null) {
            return;
        }

        long orderCode = checkout.getOrderCode();
        long amount = checkout.getAmount();
        String description = checkout.getDescription();
        String planTier = request != null && request.getPlanTier() != null ? request.getPlanTier() : "PRO";

        log.info("[Sandbox PayOS Aspect] Intercepted payment link generation for orderCode={}, amount={}. Registering in PayOsSimulator...",
                orderCode, amount);

        payOsSimulator.createOrder(
                orderCode,
                (int) amount,
                description,
                "sandbox-tenant",
                planTier
        );
    }
}
