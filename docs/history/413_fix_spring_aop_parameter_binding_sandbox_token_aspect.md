# 413 - Fix Spring AOP Parameter Binding in SandboxTokenAspect

## Problem
During login, calls to `com.acc.user.service.TokenService.getToken` failed with:
```text
java.lang.IllegalStateException: Required to bind 2 arguments, but only bound 1 (JoinPointMatch was NOT bound in invocation)
    at org.springframework.aop.aspectj.AbstractAspectJAdvice.argBinding(AbstractAspectJAdvice.java:605)
    at org.springframework.aop.aspectj.AbstractAspectJAdvice.invokeAdviceMethod(AbstractAspectJAdvice.java:630)
    at org.springframework.aop.aspectj.AspectJAroundAdvice.invoke(AspectJAroundAdvice.java:70)
```
In `SandboxTokenAspect`, the pointcut expressions used `&& args(request)`:
```java
@Around("execution(* com.acc.user.service.TokenService.getToken(..)) && args(request)")
public Object interceptGetToken(ProceedingJoinPoint pjp, RequestWrapper<ContextHeader, AuthenticationRequestBody> request)
```
When compiled without `-parameters` metadata preserved for aspect advice parameter names (or when CGLIB proxies invoke interface-advised targets with generic types), AspectJ's `argBinding` cannot resolve parameter name `request` at runtime. Because only `ProceedingJoinPoint` was bound, AspectJ threw an `IllegalStateException` expecting 2 bound arguments instead of 1.

## Plan
1. Refactor `SandboxTokenAspect`'s `@Around` advice methods (`interceptGetToken` and `interceptRefreshToken`) to bind only `ProceedingJoinPoint pjp` in the method signature.
2. Read the request object directly from `pjp.getArgs()[0]` with defensive type checking.
3. Update unit tests in `SandboxTokenAspectTest` to mock `pjp.getArgs()`.
4. Verify tests pass.

## Changes
- `apps/api/acc-sandbox/src/main/java/com/acc/sandbox/auth/SandboxTokenAspect.java`:
  Removed `&& args(request)` pointcut clause and extracted `request` cleanly from `pjp.getArgs()`.
- `apps/api/acc-sandbox/src/test/java/com/acc/sandbox/auth/SandboxTokenAspectTest.java`:
  Updated test cases to mock `pjp.getArgs()` with the input `RequestWrapper`.

## Verification
- Ran `node apps/api/mvnw.cjs -pl acc-sandbox -Dtest=SandboxTokenAspectTest test`:
  3/3 tests passed with 0 errors.
