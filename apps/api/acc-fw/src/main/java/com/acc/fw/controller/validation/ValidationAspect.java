package com.acc.fw.controller.validation;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import br.com.fluentvalidator.Validator;
import br.com.fluentvalidator.context.Error;
import br.com.fluentvalidator.context.ValidationResult;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.BeanFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.acc.core.exception.BusinessException;
import com.acc.core.io.validation.ViolationDetail;

/**
 * Aspect for logging execution of service and repository Spring components.
 *
 * By default, it only runs with the "dev" profile.
 */

@Component
@Aspect
public class ValidationAspect {

  private final Logger log = LoggerFactory.getLogger(this.getClass());

  @Autowired
  BeanFactory beanFactory;

  /**
   * Pointcut that matches all Web REST endpoints' controllers.
   */
  @Pointcut("execution(* com.acc..*Controller.*(..))")
  public void validationPointCut() {
  }

  /**
   * Advice that validate method parameters
   *
   * @param joinPoint join point for advice
   * @return result
   * @throws Throwable throws IllegalArgumentException
   */
  @SuppressWarnings({ "rawtypes", "unchecked" })
  @Around("validationPointCut()")
  public Object logAround(ProceedingJoinPoint joinPoint) throws Throwable {
    if (joinPoint.getArgs() != null && joinPoint.getSignature() instanceof MethodSignature) {
      Object[] arguments = joinPoint.getArgs();
      Map<Integer, Optional<Validator>> validatorMap = getValidatorMap(joinPoint, arguments);
      if(validatorMap !=null) {
        List<ViolationDetail> violationDetails = new ArrayList<>();
        for(Entry<Integer, Optional<Validator>> entry: validatorMap.entrySet()) {
          if(entry.getValue().isPresent()) {
            ValidationResult result = entry.getValue().get().validate(arguments[entry.getKey()]);
            violationDetails.addAll(
                result.getErrors()
                      .stream()
                      .map(e -> ViolationDetail.builder()
                                                .key(e.getCode())
                                                .description(e.getMessage())
                                                .target(e.getAttemptedValue())
                                                .field(e.getField())
                                                .build())
                      .collect(Collectors.toList())
            );
          }
        }
        if(violationDetails.size() > 0) {
          throw BusinessException.create().add(violationDetails);
        }
      }
    }
    return joinPoint.proceed();
  }

  private Map<Integer, Optional<Validator>> getValidatorMap(ProceedingJoinPoint joinPoint, Object[] arguments) {
    MethodSignature signature = (MethodSignature) joinPoint.getSignature();
    Method method = signature.getMethod();
    Annotation[][] annotations = method.getParameterAnnotations();
    Parameter[] parameters = method.getParameters();
    Map<Integer, Optional<Validator>> validates = null;
    if(arguments.length == parameters.length && arguments.length > 0) {
      validates = IntStream.range(0, arguments.length)
                           .boxed()
                           .collect(Collectors.toMap(
                               Function.identity()
                               , i -> Stream.of(parameters[i].getAnnotations())
                                            .filter(annotation -> annotation.annotationType().equals(Validate.class))
                                            .map(Validate.class::cast)
                                            .map(validate -> beanFactory.getBean(validate.name(), Validator.class))
                                            .findAny())
                           );

    }
    return validates;
  }
}
