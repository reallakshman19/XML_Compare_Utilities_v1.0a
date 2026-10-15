export const XML_COMPARE_LINEWISE_INFO_RULE_RUNTIME_SCHEMA = 'xml-compare-linewise-info-rule-runtime/v2-inert';

export {
  LINEWISE_XML_OWNERSHIP_RULE_TEXT,
  renderLinewiseInfoRuleButtonHtml,
  renderLinewiseInfoRuleModalHtml,
} from '../xml-compare/XmlCompareLinewiseInfoRule.js';

export function installXmlCompareLinewiseInfoRuleRuntime() {
  return false;
}

export const _test = Object.freeze({ installXmlCompareLinewiseInfoRuleRuntime });
