package com.acc.core.helper;


import org.apache.commons.lang3.RandomUtils;

public class RandomHelper {
    public boolean getBase100Probability(int percentage){
        return RandomUtils.nextInt(1, 101)<=percentage;
    }
}
