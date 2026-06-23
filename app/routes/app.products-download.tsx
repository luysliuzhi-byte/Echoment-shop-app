import { useLoaderData, useFetcher, useNavigate, LoaderFunctionArgs } from "react-router";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { admin } = await authenticate.admin(request);

    let allProducts: any[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
        const response: Response = await admin.graphql(
            `#graphql
        query getProducts($first: Int!, $after: String) {
          products(first: $first, sortKey: CREATED_AT, reverse: true, after: $after) {
            edges {
              node {
                id
                title
                handle
                createdAt
                updatedAt
                status
                featuredImage {
                  url
                  altText
                }
                images(first: 20) {
                  edges {
                    node {
                      url
                      altText
                    }
                  }
                }
                variants(first: 10) {
                  edges {
                    node {
                      id
                      title
                      price
                      inventoryQuantity
                      image {
                        url
                        altText
                      }
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }`,
            {
                variables: {
                    first: 250,
                    after: cursor,
                },
            },
        );

        const responseJson: any = await response.json();
        const productsData = responseJson.data?.products;

        if (productsData?.edges) {
            allProducts = [...allProducts, ...productsData.edges];
        }

        hasNextPage = productsData?.pageInfo?.hasNextPage || false;
        cursor = productsData?.pageInfo?.endCursor || null;
    }

    return {
        products: allProducts,
    };
};

export default function ProductDownloadPage() {
    const { products } = useLoaderData<typeof loader>();
    const fetcher = useFetcher<typeof loader>();
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<{ current: number; totalImages: number; downloadedImages: number; productName: string } | null>(null);

    const toggleProductSelection = (productId: string) => {
        setSelectedProducts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(productId)) {
                newSet.delete(productId);
            } else {
                newSet.add(productId);
            }
            return newSet;
        });
    };

    const toggleSelectAll = () => {
        if (selectedProducts.size === filteredProducts.length) {
            setSelectedProducts(new Set());
        } else {
            setSelectedProducts(new Set(filteredProducts.map((edge: any) => edge.node.id)));
        }
    };

    const handleRefresh = () => {
        fetcher.load('/app/products-download');
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
            fetcher.load('/app/products-download');
        }, 60000);
        return () => clearInterval(refreshTimer);
    }, []);

    const displayProducts = fetcher.data?.products || products;

    const filteredProducts = displayProducts.filter((edge: any) => {
        const product = edge.node;
        if (statusFilter === 'ALL') return true;
        return product.status === statusFilter;
    });

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

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            ACTIVE: '#059669',
            DRAFT: '#6b7280',
            ARCHIVED: '#9ca3af',
        };
        return colors[status] || '#6b7280';
    };

    const handleDownload = async () => {
        const productsToDownload = selectedProducts.size > 0
            ? filteredProducts.filter((edge: any) => selectedProducts.has(edge.node.id))
            : filteredProducts;

        if (productsToDownload.length === 0) {
            alert('没有可下载的产品');
            return;
        }

        setDownloading(true);
        setDownloadProgress({ current: 0, totalImages: 1, downloadedImages: 0, productName: '准备开始...' });

        try {
            const now = new Date();
            const folderName = `产品下载_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

            const downloadQueue = productsToDownload.map((edge: any) => ({
                id: edge.node.id,
                title: edge.node.title,
                images: edge.node.images.edges.map((img: any) => img.node.url),
            }));

            const totalImages = downloadQueue.reduce((sum: number, p: any) => sum + p.images.length, 0);

            setDownloadProgress({ current: 10, totalImages, downloadedImages: 0, productName: '正在下载图片...' });

            const response = await fetch('/app/products-download/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    folderName,
                    products: downloadQueue,
                }),
            });

            setDownloadProgress({ current: 80, totalImages, downloadedImages: totalImages, productName: '正在处理...' });

            if (!response.ok) {
                throw new Error('Download failed');
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${folderName}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setDownloadProgress({ current: 100, totalImages, downloadedImages: totalImages, productName: '下载完成!' });
            setTimeout(() => {
                setDownloading(false);
                setDownloadProgress(null);
                // alert(`下载完成！\n已处理 ${totalImages} 张图片\n文件名: ${folderName}.zip`);
            }, 1500);

        } catch (error) {
            setDownloading(false);
            setDownloadProgress(null);
            alert(`下载失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const statusOptions = [
        { value: 'ALL', label: '全部' },
        { value: 'ACTIVE', label: '已发布' },
        { value: 'DRAFT', label: '草稿' },
        { value: 'ARCHIVED', label: '已归档' },
    ];

    return (
        <s-page
            heading={`产品下载 (${filteredProducts.length})`}
            inlineSize="large"
        >
            <s-section heading={`最后更新: ${formatDate(currentTime.toISOString())}`}>
                <s-stack direction="block" gap="base">
                    <div style={{
                        display: 'flex',
                        gap: '16px',
                        marginBottom: '16px',
                        flexWrap: 'wrap',
                        alignItems: 'flex-end',
                    }}>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                            <label style={{
                                display: 'block',
                                marginBottom: '8px',
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#374151',
                            }}>
                                产品状态筛选
                            </label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
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
                                {statusOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
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
                                    opacity: fetcher.state === 'loading' ? 0.6 : 1,
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

                            <button
                                onClick={handleDownload}
                                disabled={downloading || filteredProducts.length === 0}
                                style={{
                                    padding: '8px 20px',
                                    border: 'none',
                                    borderRadius: '6px',
                                    backgroundColor: downloading ? '#9ca3af' : '#059669',
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: downloading ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    minWidth: '140px',
                                    justifyContent: 'center',
                                }}
                            >
                                {downloading ? (
                                    <>
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            style={{ animation: 'spin 1s linear infinite' }}
                                        >
                                            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                                        </svg>
                                        下载中...
                                    </>
                                ) : (
                                    <>
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                            <polyline points="7 10 12 15 17 10"></polyline>
                                            <line x1="12" y1="15" x2="12" y2="3"></line>
                                        </svg>
                                        下载产品
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {downloadProgress && (
                        <div style={{
                            padding: '16px',
                            backgroundColor: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            borderRadius: '8px',
                            marginBottom: '16px',
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '8px',
                            }}>
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="#059669"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    style={{ animation: 'spin 1s linear infinite' }}
                                >
                                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                                </svg>
                                <span style={{ fontWeight: '500', color: '#166534' }}>
                                    正在下载: {downloadProgress.productName}
                                </span>
                            </div>
                            <div style={{
                                width: '100%',
                                height: '8px',
                                backgroundColor: '#d1fae5',
                                borderRadius: '4px',
                                overflow: 'hidden',
                            }}>
                                <div style={{
                                    width: `${downloadProgress.current}%`,
                                    height: '100%',
                                    backgroundColor: '#059669',
                                    transition: 'width 0.3s ease',
                                }} />
                            </div>
                            <div style={{
                                marginTop: '8px',
                                fontSize: '13px',
                                color: '#166534',
                            }}>
                                {downloadProgress.downloadedImages} / {downloadProgress.totalImages} 张图片
                            </div>
                        </div>
                    )}

                    <div style={{
                        padding: '12px 16px',
                        backgroundColor: '#f9fafb',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        marginBottom: '16px',
                        fontSize: '14px',
                        color: '#6b7280',
                    }}>
                        {selectedProducts.size > 0 ? (
                            <span>已选择 <strong>{selectedProducts.size}</strong> 个产品，将只下载选中的产品</span>
                        ) : (
                            <span>未选择产品，将下载全部 <strong>{filteredProducts.length}</strong> 个产品</span>
                        )}
                    </div>

                    {filteredProducts.length === 0 ? (
                        <s-paragraph>暂无产品数据</s-paragraph>
                    ) : (
                        <div style={{
                            overflowY: 'auto',
                            overflowX: 'auto',
                            maxHeight: 'calc(100vh - 340px)',
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
                                            textAlign: 'center',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            color: '#374151',
                                            width: '50px',
                                        }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                                                onChange={toggleSelectAll}
                                                style={{
                                                    width: '18px',
                                                    height: '18px',
                                                    cursor: 'pointer',
                                                    accentColor: '#059669',
                                                }}
                                            />
                                        </th>
                                        <th style={{
                                            padding: '12px 16px',
                                            textAlign: 'left',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            color: '#374151',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            width: '50px',
                                        }}>
                                            图片
                                        </th>
                                        <th style={{
                                            padding: '12px 16px',
                                            textAlign: 'left',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            color: '#374151',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            minWidth: '200px',
                                        }}>
                                            产品名称
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
                                            产品状态
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
                                        }}>
                                            图片数量
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
                                            创建时间
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredProducts.map((edge: any) => {
                                        const product = edge.node;
                                        const isSelected = selectedProducts.has(product.id);
                                        const imageCount = product.images.edges.length;

                                        return (
                                            <tr
                                                key={product.id}
                                                style={{
                                                    backgroundColor: isSelected ? '#f0fdf4' : 'white',
                                                    borderBottom: '1px solid #e5e7eb',
                                                    transition: 'background-color 0.15s',
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!isSelected) {
                                                        e.currentTarget.style.backgroundColor = '#f9fafb';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (!isSelected) {
                                                        e.currentTarget.style.backgroundColor = 'white';
                                                    }
                                                }}
                                            >
                                                <td style={{
                                                    padding: '12px 16px',
                                                    textAlign: 'center',
                                                }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleProductSelection(product.id)}
                                                        style={{
                                                            width: '18px',
                                                            height: '18px',
                                                            cursor: 'pointer',
                                                            accentColor: '#059669',
                                                        }}
                                                    />
                                                </td>
                                                <td style={{
                                                    padding: '12px 16px',
                                                    textAlign: 'center',
                                                }}>
                                                    {product.featuredImage ? (
                                                        <img
                                                            src={product.featuredImage.url}
                                                            alt={product.featuredImage.altText || product.title}
                                                            style={{
                                                                width: '48px',
                                                                height: '48px',
                                                                objectFit: 'cover',
                                                                borderRadius: '6px',
                                                                border: '1px solid #e5e7eb',
                                                            }}
                                                        />
                                                    ) : (
                                                        <div style={{
                                                            width: '48px',
                                                            height: '48px',
                                                            backgroundColor: '#f3f4f6',
                                                            borderRadius: '6px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            border: '1px solid #e5e7eb',
                                                        }}>
                                                            <svg
                                                                width="20"
                                                                height="20"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="#9ca3af"
                                                                strokeWidth="2"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            >
                                                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                                                <polyline points="21 15 16 10 5 21"></polyline>
                                                            </svg>
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{
                                                    padding: '12px 16px',
                                                    fontSize: '14px',
                                                    color: '#111827',
                                                    fontWeight: '500',
                                                }}>
                                                    {product.title}
                                                </td>
                                                <td style={{
                                                    padding: '12px 16px',
                                                }}>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        padding: '4px 10px',
                                                        borderRadius: '9999px',
                                                        fontSize: '12px',
                                                        fontWeight: '500',
                                                        backgroundColor: `${getStatusColor(product.status)}15`,
                                                        color: getStatusColor(product.status),
                                                    }}>
                                                        {product.status === 'ACTIVE' ? '已发布' : product.status === 'DRAFT' ? '草稿' : '已归档'}
                                                    </span>
                                                </td>
                                                <td style={{
                                                    padding: '12px 16px',
                                                    fontSize: '14px',
                                                    color: '#6b7280',
                                                }}>
                                                    {imageCount}
                                                </td>
                                                <td style={{
                                                    padding: '12px 16px',
                                                    fontSize: '14px',
                                                    color: '#6b7280',
                                                }}>
                                                    {formatDate(product.createdAt)}
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

            <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
        </s-page>
    );
}