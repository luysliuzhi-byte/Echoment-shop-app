/*
 * @Description: 
 * @Date: 2026-05-25 14:30
 * @LastEditTime: 2026-06-23 16:00
 */
import { useLoaderData, useFetcher, LoaderFunctionArgs } from "react-router";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
    query getOrders {
      orders(first: 50, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            name
            processedAt
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            displayFinancialStatus
            displayFulfillmentStatus
            customer {
              firstName
              lastName
              email
            }
            lineItems(first: 10) {
              edges {
                node {
                  title
                  quantity
                  variant {
                    price
                    image {
                      url
                      altText
                    }
                    selectedOptions {
                      name
                      value
                    }
                  }
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
    orders: responseJson.data?.orders?.edges || [],
  };
};

export default function OrdersPage() {
  const { orders } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof loader>();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [financialFilter, setFinancialFilter] = useState<string>('ALL');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string>('ALL');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const handleRefresh = () => {
    fetcher.load('/app/orders');
    setCurrentTime(new Date());
  };


  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const refreshTimer = setInterval(() => {
      fetcher.load('/app/orders');
    }, 60000);
    return () => clearInterval(refreshTimer);
  }, []);

  const displayOrders = fetcher.data?.orders || orders;

  const filteredOrders = displayOrders.filter((edge: any) => {
    const order = edge.node;
    const matchFinancial = financialFilter === 'ALL' || order.displayFinancialStatus === financialFilter;
    const matchFulfillment = fulfillmentFilter === 'ALL' || order.displayFulfillmentStatus === fulfillmentFilter;
    return matchFinancial && matchFulfillment;
  });

  const formatPrice = (amount: string, currencyCode: string) => {
    return `${parseFloat(amount).toFixed(2)} ${currencyCode}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFinancialStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PAID: '#059669',
      PARTIALLY_PAID: '#d97706',
      PENDING: '#6b7280',
      REFUNDED: '#dc2626',
      VOIDED: '#9ca3af',
    };
    return colors[status] || '#6b7280';
  };

  const getFulfillmentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      FULFILLED: '#059669',
      IN_PROGRESS: '#d97706',
      PARTIALLY_FULFILLED: '#f59e0b',
      PENDING: '#6b7280',
      RESTOCKED: '#9ca3af',
    };
    return colors[status] || '#6b7280';
  };

  const financialStatusOptions = [
    { value: 'ALL', label: '全部' },
    { value: 'PAID', label: '已付款' },
    { value: 'PARTIALLY_PAID', label: '部分付款' },
    { value: 'PENDING', label: '待付款' },
    { value: 'REFUNDED', label: '已退款' },
    { value: 'VOIDED', label: '已作废' },
  ];

  const fulfillmentStatusOptions = [
    { value: 'ALL', label: '全部' },
    { value: 'FULFILLED', label: '已发货' },
    { value: 'IN_PROGRESS', label: '处理中' },
    { value: 'PARTIALLY_FULFILLED', label: '部分发货' },
    { value: 'PENDING', label: '待发货' },
    { value: 'RESTOCKED', label: '已重新入库' },
  ];

  return (
    <s-page
      heading={`订单列表 (${filteredOrders.length})`}
      inlineSize="large"
    >
      <s-section heading={`最后更新: ${formatDate(currentTime.toISOString())}`}>
        <s-stack direction="block" gap="base">
          <div style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '16px',
            flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
              }}>
                付款状态筛选
              </label>
              <select
                value={financialFilter}
                onChange={(e) => setFinancialFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                }}
              >
                {financialStatusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
              }}>
                发货状态筛选
              </label>
              <select
                value={fulfillmentFilter}
                onChange={(e) => setFulfillmentFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                }}
              >
                {fulfillmentStatusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleRefresh}
              disabled={fetcher.state === 'loading'}
              style={{
                padding: '8px 16px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                backgroundColor: fetcher.state === 'loading' ? '#f3f4f6' : 'white',
                color: fetcher.state === 'loading' ? '#9ca3af' : '#374151',
                fontSize: '14px',
                fontWeight: '500',
                cursor: fetcher.state === 'loading' ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                minWidth: '100px',
                height: '38px',
                alignSelf: 'flex-end',
                opacity: fetcher.state === 'loading' ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (fetcher.state !== 'loading') {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                  e.currentTarget.style.borderColor = '#d1d5db';
                }
              }}
              onMouseLeave={(e) => {
                if (fetcher.state !== 'loading') {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  animation: fetcher.state === 'loading' ? 'spin 1s linear infinite' : 'none',
                }}
              >
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              {fetcher.state === 'loading' ? '刷新中...' : '刷新数据'}
            </button>
          </div>

          {filteredOrders.length === 0 ? (
            <s-paragraph>暂无订单数据</s-paragraph>
          ) : (
            <div style={{
              overflowY: 'auto',
              overflowX: 'auto',
              maxHeight: 'calc(100vh - 240px)',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              backgroundColor: 'white',
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}>
                <thead style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  backgroundColor: '#f9fafb',
                }}>
                  <tr style={{
                    backgroundColor: '#f9fafb',
                    borderBottom: '2px solid #e5e7eb',
                  }}>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#374151',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      width: '8%',
                      minWidth: '60px',
                    }}>
                      订单编号
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#374151',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      maxWidth: '25%',
                    }}>
                      商品信息
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#374151',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      width: '12%',
                      minWidth: '60px',
                    }}>
                      创建时间
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#374151',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      width: '15%',
                    }}>
                      客户信息
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#374151',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      width: '12%',
                    }}>
                      付款状态
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#374151',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      width: '13%',
                      minWidth: '80px',
                    }}>
                      发货状态
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#374151',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      width: '10%',
                      minWidth: '110px',
                    }}>
                      订单金额
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((edge: any) => {
                    const order = edge.node;
                    return (
                      <tr
                        key={order.id}
                        style={{
                          borderBottom: '1px solid #e5e7eb',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'white';
                        }}
                      >
                        <td style={{
                          padding: '16px',
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#111827',
                        }}>
                          {order.name}
                        </td>
                        <td style={{
                          padding: '16px',
                          fontSize: '13px',
                          color: '#374151',
                        }}>
                          {order.lineItems?.edges?.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {order.lineItems.edges.slice(0, expandedOrders.has(order.id) ? order.lineItems.edges.length : 2).map((itemEdge: any, index: number) => {
                                const item = itemEdge.node;
                                const hasImage = item.variant?.image?.url;
                                const hasOptions = item.variant?.selectedOptions?.length > 0;

                                return (
                                  <div key={index} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                    {hasImage ? (
                                      <img
                                        src={item.variant.image.url}
                                        alt={item.variant.image.altText || item.title}
                                        style={{
                                          width: '48px',
                                          height: '48px',
                                          objectFit: 'cover',
                                          borderRadius: '4px',
                                          border: '1px solid #e5e7eb',
                                          flexShrink: 0,
                                        }}
                                      />
                                    ) : (
                                      <div style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '4px',
                                        border: '1px solid #e5e7eb',
                                        backgroundColor: '#f9fafb',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        fontSize: '20px',
                                        color: '#9ca3af',
                                      }}>
                                        📦
                                      </div>
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{
                                        fontWeight: '500',
                                        marginBottom: '4px',
                                        fontSize: '13px',
                                        color: '#111827',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}>
                                        {item.title}
                                      </div>
                                      <div style={{
                                        fontSize: '12px',
                                        color: '#6b7280',
                                        marginBottom: '4px',
                                      }}>
                                        数量: {item.quantity}
                                      </div>
                                      {hasOptions && (
                                        <div style={{
                                          fontSize: '11px',
                                          color: '#9ca3af',
                                          display: 'flex',
                                          flexWrap: 'wrap',
                                          gap: '4px',
                                        }}>
                                          {item.variant.selectedOptions.map((option: any, optIndex: number) => (
                                            <span key={optIndex} style={{
                                              backgroundColor: '#f3f4f6',
                                              padding: '2px 6px',
                                              borderRadius: '3px',
                                            }}>
                                              {option.name}: {option.value}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                              {order.lineItems.edges.length > 2 && (
                                <button
                                  onClick={() => toggleOrderExpansion(order.id)}
                                  style={{
                                    fontSize: '12px',
                                    color: '#0066cc',
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                    fontStyle: 'italic',
                                    fontWeight: '500',
                                    transition: 'color 0.2s',
                                    width: "186px"
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.color = '#0052a3';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.color = '#0066cc';
                                  }}
                                >
                                  {expandedOrders.has(order.id)
                                    ? `收起商品`
                                    : `+${order.lineItems.edges.length - 2} 更多商品`
                                  }
                                </button>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#9ca3af' }}>无商品信息</span>
                          )}
                        </td>
                        <td style={{
                          padding: '16px',
                          fontSize: '13px',
                          color: '#6b7280',
                        }}>
                          {formatDate(order.processedAt)}
                        </td>
                        <td style={{
                          padding: '16px',
                          fontSize: '13px',
                          color: '#374151',
                        }}>
                          {order.customer ? (
                            <div>
                              <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                                {order.customer.firstName} {order.customer.lastName}
                              </div>
                              <div style={{ color: '#6b7280', fontSize: '12px' }}>
                                {order.customer.email}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: '#9ca3af' }}>无客户信息</span>
                          )}
                        </td>
                        <td style={{
                          padding: '16px',
                        }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '500',
                            backgroundColor: getFinancialStatusColor(order.displayFinancialStatus) + '15',
                            color: getFinancialStatusColor(order.displayFinancialStatus),
                          }}>
                            {order.displayFinancialStatus}
                          </span>
                        </td>
                        <td style={{
                          padding: '16px',
                        }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '500',
                            backgroundColor: getFulfillmentStatusColor(order.displayFulfillmentStatus) + '15',
                            color: getFulfillmentStatusColor(order.displayFulfillmentStatus),
                          }}>
                            {order.displayFulfillmentStatus}
                          </span>
                        </td>
                        <td style={{
                          padding: '16px',
                          textAlign: 'left',
                          fontSize: '15px',
                          fontWeight: '600',
                          color: '#111827',
                        }}>
                          {formatPrice(
                            order.totalPriceSet.shopMoney.amount,
                            order.totalPriceSet.shopMoney.currencyCode
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </s-stack>
      </s-section>
    </s-page>

  );

}