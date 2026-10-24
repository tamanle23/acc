package com.unipost.identity.infra.user.repository.jpa;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;

import com.unipost.user.model.enums.UserType;
import com.unipost.user.model.User;

import org.springframework.data.jpa.domain.Specification;

public class UserSearchCriteria extends User implements Specification<User> {

	private static final long serialVersionUID = -6019784132716027681L;

	@Override
	public Predicate toPredicate(Root<User> root,CriteriaQuery<?> criteriaquery, CriteriaBuilder criteriabuilder) {
		Predicate predicate =  criteriabuilder.conjunction();
//		if(StringUtils.isNotBlank(this.getName())){
//			predicate = criteriabuilder.and(criteriabuilder.or(
//					criteriabuilder.like(
//							criteriabuilder.lower(root.<String>get("name"))
//							,CriteriaHelper.getContainsLikePattern(this.getName())
//						)
//					,criteriabuilder.like(
//							criteriabuilder.lower(root.<String>get("userName"))
//							,CriteriaHelper.getContainsLikePattern(this.getName())
//						)
//				));
//		}
		if(this.getStatus() != null){
			predicate = criteriabuilder.and(predicate
									,criteriabuilder.equal(root.<Boolean>get("accountStatus")
														,this.getStatus()
													)
							);
		}
		if(this.getType() != null){
			predicate = criteriabuilder.and(predicate
									,criteriabuilder.equal(root.<UserType>get("accountType")
														,this.getType()
													)
							);
		}
		return predicate;
	}
}
