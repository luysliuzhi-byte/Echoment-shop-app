import type {
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};

export default function Index() {
  return (
    <s-page heading="私人定制APP">
      <s-section heading="欢迎来到私人定制APP页面">
        <s-paragraph>
          本应用为您提供批量商品管理和实时订单监控功能，帮助您高效管理店铺运营。
        </s-paragraph>
      </s-section>

      <s-section heading="功能模块">
        <s-stack direction="block" gap="base">
          <s-heading>批量修改商品</s-heading>
          <s-paragraph>
            快速批量修改商品名称和描述，支持多种编辑模式，提高商品管理效率。
          </s-paragraph>
          <s-button href="/app/batch-edit">开始批量编辑</s-button>
        </s-stack>
      </s-section>

      <s-section heading="功能模块">
        <s-stack direction="block" gap="base">
          <s-heading>实时订单监控</s-heading>
          <s-paragraph>
            实时查看订单信息，包括订单号、下单日期、客户信息、渠道、金额、币种、支付状态、发货状态、商品数量等详细信息。
          </s-paragraph>
          <s-button href="/app/orders">查看实时订单</s-button>
        </s-stack>
      </s-section>

      <s-section heading="功能模块">
        <s-stack direction="block" gap="base">
          <s-heading>产品图片下载</s-heading>
          <s-paragraph>
            批量下载产品图片，支持勾选特定产品或下载全部产品，图片将按产品分类保存到本地文件夹。
          </s-paragraph>
          <s-button href="/app/products-download">下载产品图片</s-button>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="使用说明">
        <s-paragraph>
          <s-text>批量修改商品：</s-text>
          支持选择多个商品进行批量编辑，可同时修改商品名称和描述信息。
        </s-paragraph>
        <s-paragraph>
          <s-text>实时订单监控：</s-text>
          自动获取最新订单数据，实时显示订单状态和详细信息。
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};