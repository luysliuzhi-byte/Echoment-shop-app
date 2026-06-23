/*
 * @Description: 
 * @Date: 2026-05-25 14:30
 * @LastEditTime: 2026-06-23 16:00
 */
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { useState, useEffect, useRef } from "react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
    query getProducts {
      products(first: 50) {
        edges {
          node {
            id
            title
            description
            handle
            featuredImage {
              url
            }
            variants(first: 1) {
              edges {
                node {
                  price
                  id
                  availableForSale
                  inventoryQuantity
                  sku
                }
              }
            }
          }
        }
      }
    }`,
    {
      variables: {},
    },
  );

  const responseJson = await response.json();

  return {
    products: responseJson.data?.products?.edges || [],
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const productIds = formData.get('productIds') as string;
  const newTitle = formData.get('title') as string;
  const newDescription = formData.get('description') as string;

  if (!productIds || !newTitle) {
    return { error: '请选择商品并填写名称' };
  }

  const ids = productIds.split(',').filter(id => id.trim());

  const results: Array<{
    productId: string;
    success: boolean;
    data?: unknown;
    error?: string;
  }> = [];
  for (const productId of ids) {
    try {
      const response = await admin.graphql(
        `#graphql
        mutation productUpdate($product: ProductUpdateInput!) {
          productUpdate(product: $product) {
            product {
              id
              title
              description
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            product: {
              id: productId,
              title: newTitle,
              descriptionHtml: newDescription || '',
            },
          },
        },
      );

      const responseJson = (await response.json()) as {
        data?: { productUpdate?: { userErrors?: { message: string }[] } };
        errors?: { message: string }[];
      };
      const gqlErrors = responseJson.errors?.length
        ? responseJson.errors.map((e) => e.message).join('; ')
        : '';
      const payload = responseJson.data?.productUpdate;
      const userErrMsgs = payload?.userErrors?.length
        ? payload.userErrors.map((e: { message: string }) => e.message).join('; ')
        : '';

      const success =
        !gqlErrors && !!payload && !payload.userErrors?.length;

      results.push({
        productId,
        success,
        data: payload,
        error: gqlErrors || userErrMsgs || undefined,
      });
    } catch (error) {
      results.push({
        productId,
        success: false,
        error: String(error),
      });
    }
  }

  return { results };
};

export default function BatchEditPage() {
  const { products } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const processedResultsRef = useRef<string | null>(null);

  const handleProductSelect = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(products.map((p: any) => p.node.id));
    } else {
      setSelectedProducts([]);
    }
  };

  const handleSubmit = () => {
    if (selectedProducts.length === 0) {
      alert('请先选择商品');
      return;
    }
    if (!title.trim()) {
      alert('请输入商品名称');
      return;
    }

    const formData = new FormData();
    formData.append('productIds', selectedProducts.join(','));
    formData.append('title', title);
    formData.append('description', description);

    fetcher.submit(formData, { method: 'POST' });
  };

  const selectedProductDetails = products.filter((p: any) =>
    selectedProducts.includes(p.node.id)
  );

  const isLoading = fetcher.state === 'submitting';
  const canSubmit =
    selectedProducts.length > 0 && title.trim().length > 0 && !isLoading;

  // 监听修改结果，如果全部成功则显示成功弹框
  useEffect(() => {
    if (fetcher.data?.results) {
      const resultsKey = JSON.stringify(fetcher.data.results);
      if (processedResultsRef.current !== resultsKey && !showSuccessModal) {
        const allSuccess = fetcher.data.results.every((r: any) => r.success);
        if (allSuccess) {
          processedResultsRef.current = resultsKey;
          setShowSuccessModal(true);
        }
      }
    }
  }, [fetcher.data?.results, showSuccessModal]);

  // 自动关闭成功弹框（0.5秒）
  useEffect(() => {
    if (showSuccessModal) {
      console.log('showSuccessModal', showSuccessModal);
      const timer = setTimeout(() => {
        setShowSuccessModal(false);
        console.log('closeSuccessModal', showSuccessModal);
        setSelectedProducts([]);
        setTitle('');
        setDescription('');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showSuccessModal]);

  return (
    <s-page heading="批量修改商品">
      <s-section heading="商品信息编辑">
        <s-stack direction="block" gap="base">
          <s-grid>
            <s-heading >商品名称</s-heading>
            <s-text-field
              name="title"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              placeholder="输入新的商品名称"
              required
            />
          </s-grid>

          <s-grid>
            <s-heading >商品描述</s-heading>
            <s-paragraph>
              <textarea
                style={{
                  width: '98%',
                  minHeight: '120px',
                  padding: '8px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                }}
                placeholder="请输入商品描述"
                value={description}
                onChange={(e) => setDescription(e.currentTarget.value)}
              />
            </s-paragraph>
          </s-grid>

          <s-grid>
            <s-heading>选择商品与提交</s-heading>
            <div style={{ marginBottom: '8px' }}></div>
            <s-stack direction="inline" gap="base">
              <s-button onClick={() => setShowProductModal(true)}>
                选择要修改的商品 ({selectedProducts.length})
              </s-button>
              <s-button
                variant="primary"
                disabled={!canSubmit}
                onClick={handleSubmit}
                {...(isLoading ? { loading: true } : {})}
              >
                立即修改
              </s-button>
              <s-button
                variant="tertiary"
                onClick={() => {
                  setSelectedProducts([]);
                  setTitle('');
                  setDescription('');
                }}
              >
                重置
              </s-button>
            </s-stack>
          </s-grid>
        </s-stack>
      </s-section>

      {selectedProductDetails.length > 0 && (
        <s-section heading="已选商品">
          <s-paragraph>
            已选择 {selectedProductDetails.length} 个商品
          </s-paragraph>
          <s-grid>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>商品图片</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>当前名称</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>当前描述</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>价格</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {selectedProductDetails.map((product: any) => (
                  <tr key={product.node.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '8px' }}>
                      {product.node.featuredImage ? (
                        <img
                          src={product.node.featuredImage.url}
                          alt={product.node.title}
                          style={{ width: '50px', height: '50px', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ width: '50px', height: '50px', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          无图片
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '8px' }}>{product.node.title}</td>
                    <td style={{ padding: '8px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {product.node.description || '无描述'}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {product.node.variants?.edges?.[0]?.node?.price || '-'}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <s-button
                        variant="tertiary"
                        onClick={() => handleProductSelect(product.node.id)}
                      >
                        移除
                      </s-button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </s-grid>
        </s-section>
      )}

      {fetcher.data?.results && (
        <s-section heading="修改结果">
          <s-grid>
            <s-stack direction="block" gap="base">
              {fetcher.data.results.map((result: any, index: number) => (
                <div key={index} style={{
                  padding: '8px',
                  borderRadius: '4px',
                  background: result.success ? '#dcfce7' : '#fee2e2',
                  color: result.success ? '#166534' : '#991b1b'
                }}>
                  <s-paragraph>
                    商品 ID: {result.productId}
                  </s-paragraph>
                  <s-paragraph>
                    状态: {result.success ? '修改成功' : '修改失败'}
                  </s-paragraph>
                  {result.error && (
                    <s-paragraph>
                      错误: {result.error}
                    </s-paragraph>
                  )}
                </div>
              ))}
            </s-stack>
          </s-grid>
        </s-section>
      )}

      {showSuccessModal && (
        <div
          style={{
            position: 'fixed',
            top: '8px',
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '20px 30px',
              maxWidth: '300px',
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
              marginBottom: '200px',
            }}
          >
            <s-paragraph>
              已成功修改 {fetcher.data?.results?.length || 0} 个商品
            </s-paragraph>
          </div>
        </div>
      )}

      {showProductModal && (
        <div
          style={{
            position: 'fixed',
            top: '8px',
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '8px',
              maxWidth: '1000px',
              width: '100%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            }}
          >
            <div style={{ flex: 1, padding: '20px' }} >
              <s-stack direction="block" gap="base">
                <s-heading>选择商品</s-heading>
                <s-paragraph>
                  共 {products.length} 个商品，已选择 {selectedProducts.length} 个
                </s-paragraph>

                <s-grid>
                  <div style={{ marginBottom: '12px' }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={
                          products.length > 0 &&
                          selectedProducts.length === products.length
                        }
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                      <span>全选</span>
                    </label>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', maxHeight: 'calc(80vh - 200px)', overflowY: 'auto', display: "block", position: "relative" }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f9fafb' }}>
                      <tr
                        style={{
                          borderBottom: '1px solid #e5e7eb',
                          background: '#f9fafb',
                        }}
                      >
                        <th style={{ padding: '8px', textAlign: 'left', width: '30px', }}>
                          选择
                        </th>
                        <th style={{ padding: '8px', textAlign: 'left', width: "60px" }}>
                          商品图片
                        </th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>
                          商品名称
                        </th>
                        <th style={{ padding: '8px', textAlign: 'left', width: "80px" }}>
                          价格
                        </th>
                        <th style={{ padding: '8px', textAlign: 'left', width: "50px" }}>
                          库存
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product: any) => (
                        <tr
                          key={product.node.id}
                          style={{
                            borderBottom: '1px solid #e5e7eb',
                            background: selectedProducts.includes(product.node.id)
                              ? '#f0fdf4'
                              : 'white',
                          }}
                        >
                          <td style={{ padding: '8px' }}>
                            <input
                              type="checkbox"
                              checked={selectedProducts.includes(product.node.id)}
                              onChange={() => handleProductSelect(product.node.id)}
                            />
                          </td>
                          <td style={{ padding: '8px' }}>
                            {product.node.featuredImage ? (
                              <img
                                src={product.node.featuredImage.url}
                                alt={product.node.title}
                                style={{
                                  width: '40px',
                                  height: '40px',
                                  objectFit: 'cover',
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: '40px',
                                  height: '40px',
                                  background: '#f5f5f5',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '10px',
                                }}
                              >
                                无图
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px' }}>{product.node.title}</td>
                          <td style={{ padding: '8px' }}>
                            {product.node.variants?.edges?.[0]?.node?.price || '-'}
                          </td>
                          <td style={{ padding: '8px' }}>
                            {product.node.variants?.edges?.[0]?.node
                              ?.inventoryQuantity ?? '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </s-grid>
              </s-stack>
            </div>

            <div
              style={{
                flexShrink: 0,
                borderTop: '1px solid #e5e7eb',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                background: '#fafafa',
              }}
            >
              <s-button variant="tertiary" onClick={() => {
                setShowProductModal(false);
                setSelectedProducts([]);
              }}>
                取消
              </s-button>
              <s-button onClick={() => setShowProductModal(false)}>
                确定 ({selectedProducts.length})
              </s-button>
            </div>
          </div>
        </div>
      )}

      <s-section slot="aside" heading="批量修改说明">
        <s-paragraph>
          <s-text>步骤1：</s-text>输入新的商品名称
        </s-paragraph>
        <s-paragraph>
          <s-text>步骤2：</s-text>输入新的商品描述（可选）
        </s-paragraph>
        <s-paragraph>
          <s-text>步骤3：</s-text>点击「选择要修改的商品」在弹框中勾选（底部确定始终可见），关闭弹框
        </s-paragraph>
        <s-paragraph>
          <s-text>步骤4：</s-text>在下方「已选商品」核对后，点击同一行的「立即修改」（蓝色主按钮）提交
        </s-paragraph>
        <s-paragraph>
          <s-text>注意：</s-text>修改操作不可撤销，请谨慎操作
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};