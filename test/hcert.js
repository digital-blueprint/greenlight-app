
import {assert} from 'chai';
import {Validator} from '../src/hcert';
import {validateHCertRules, BusinessRules, ValueSets} from '../src/hcert/rules';

// This is the date the trustdata was fetched/commited
const TEST_TRUSTDATA_DATE = new Date('2021-09-08T15:35:44Z');

suite('hcert validate', () => {
    // https://github.com/eu-digital-green-certificates/dcc-quality-assurance/blob/main/AT/1.3.0/REC.png
    let TEST_REC = `HC1:NCFOXN%TSMAHN-H3ZSUZK+.V0ET9%6-AH-XI1ROR$SIOOA+ILC6LRH.I53QG%4JNO4*J8OX4UZ85XPWLI+J53O8J.V J8$XJK*L5R1ZP3LYLGS9/ZJ/T1H$JH$JGS9-.P:%BJS54-REP11Y9C+H1Y9SU3G 9L/N:PIWEG%*4AZKZ73423ZQT.EJFG3%*4JXITAFG.8P-8SC91Z8F971ZSP+PAE17DS2*N.SSBNKA.G.P6A8IM%O%KI4U3-8P$BKK.C5IAXMFU*GSHGRKMXGG%DBZI9$JAQJKS-K+:L4EQHXM*%NH$RSC91HFE2OK/M*Y8QZ8 .K/6UW6NH2KYIJ%0KBZI92KNNSQBJGZIGOJPOJC0JVLA8J3ET3:H3A+2+33U SAAUOT3TPTO4UJZIZ0KQPI59U%S2WPT YSWVBDKBYLDZ4DE1D-NSSK7DMV/CU5YJEURW17++5ERCZCVKUT8PH0ETGL9T%28$V EAZ6EIAPI1C3DBM/NG:JZ1N6IKCNH53K4FV.T4 :F51CGAR*WF44MXMBA40U:Q%3`;

    test('validate REC ok', async () => {
        let checkDate = new Date('2021-08-09T15:35:44Z');

        let test = new Validator(TEST_TRUSTDATA_DATE, false);
        let res = await test.validate(TEST_REC, checkDate, 'en');
        assert.isTrue(res.isValid);
        assert.isNull(res.error);
        assert.equal(res.firstname, 'Gabriele');
        assert.equal(res.lastname, 'Musterfrau-Gößinger');
        assert.equal(res.dob, '1998-02-26');
        assert.equal(res.validUntil.toISOString(), '2021-12-30T00:00:00.000Z');

        checkDate = new Date(checkDate.getTime());
        checkDate.setFullYear(checkDate.getFullYear() + 2000);
        res = await test.validate(TEST_REC, checkDate, 'en');
        assert.isFalse(res.isValid);
    });

    test('validate no rules', async () => {
        let checkDate = new Date('2021-08-09T15:35:44Z');

        let test = new Validator(TEST_TRUSTDATA_DATE, false);
        await test._ensureData();
        test._businessRules = test._businessRules.filter('NOPE', 'NOPE');
        let res = await test.validate(TEST_REC, checkDate, 'en');
        assert.isTrue(res.isValid);
        assert.isNull(res.error);
        assert.equal(res.firstname, 'Gabriele');
        assert.equal(res.lastname, 'Musterfrau-Gößinger');
        assert.equal(res.dob, '1998-02-26');
        // No rules, so the expiration date of the hcert defines the end date
        assert.equal(res.validUntil.toISOString(), '2022-07-15T13:32:58.000Z');
    });

    // https://github.com/eu-digital-green-certificates/dcc-quality-assurance/blob/main/AT/1.3.0/VAC.png
    let TEST_VAC = `HC1:NCF3W11Y9LVOJ109U2*62KF2C44.F4CMBL%VFWM3+H00E41R8-VFVLWN2YPNP T8%EH:T/.4Z+5OK7+VPIVB.9HAD9LR8OP3:II*VN%XG/J3B4O0+N.PM8R7XY02CP+NNXP9D/3%/2%PH%YBSEM11E06P3.AURAARUF6FHI2J092Y9.4E3MC-YL2 8VF2IJNLF8L5AIUQHN08BH-N1V9TK72O8GBK1SF7.%HXP51Z3I34I52TLBJ387XHJHSMUJ500TA9- 4EUH7KA9:4KRR3LPL2REX8.666VL1RJTZ0$8QJ2L.J1$DC.:IN01%FKKOH4$GMI1C841NKL41ZQ23P9DOF:-C%.H*T5JH0M6P:%I6YGR5LD5KVKB4EHFEIU97-5AAY2JXDK9AQ2H5 4M0OV43JTTQTQT1R9GGP3D5.0X1U7ZK BP3X5OM6Z9RVH53T6FZS0BLGQ9*55UH9+B9H6R$3NSUI9ELG78P592ZTT$1PFTECM.I7JGVH08*CS*97.FIQ9VVXQ8PUNIEAQV+9A.$0F5JPVJZX3ACDEETGYNW/50L36:3$-RZN3JTBUIFJKE+876ZJ-BDS+DV/0LX412`;

    test('validate VAC not enough', async () => {
        let checkDate = new Date('2021-08-09T15:35:44Z');

        let test = new Validator(TEST_TRUSTDATA_DATE, false);
        let res = await test.validate(TEST_VAC, checkDate, 'en');
        assert.isFalse(res.isValid);
        assert.isNotEmpty(res.error);
        assert.isNull(res.firstname, 'Gabriele');
        assert.isNull(res.lastname, 'Musterfrau-Gößinger');
        assert.isNull(res.dob, '1998-02-26');
        assert.isNull(res.validUntil);
    });

    test('rules validate empty', async () => {
        let rules = new BusinessRules();
        let valueSets = new ValueSets();
        let date = new Date("2021-09-15T14:01:17Z");
        let result = validateHCertRules({}, rules, valueSets, date, date);
        assert.isTrue(result.isValid);
        assert.isEmpty(result.errors);
    });
});
