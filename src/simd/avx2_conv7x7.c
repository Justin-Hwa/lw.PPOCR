#include "simd_kernels.h"

#include "scalar_kernels.h"

#include <stddef.h>

#if defined(_M_IX86) || defined(_M_X64) || defined(__i386__) || defined(__x86_64__)
#  include <immintrin.h>
#  define LW_COMPILES_AVX2_CONV7X7 1
#else
#  define LW_COMPILES_AVX2_CONV7X7 0
#endif

#if LW_COMPILES_AVX2_CONV7X7 && (defined(__GNUC__) || defined(__clang__))
__attribute__((target("avx2,no-fma")))
#endif
void lw_avx2_conv7x7_unit_pad3_f32(const float* input, const float* weights,
                                   const float* bias, float* output,
                                   const int32_t input_dimensions[4],
                                   const int32_t output_dimensions[4]) {
#if LW_COMPILES_AVX2_CONV7X7
    const uint32_t input_channels = (uint32_t)input_dimensions[1];
    const uint32_t height = (uint32_t)input_dimensions[2];
    const uint32_t width = (uint32_t)input_dimensions[3];
    const uint32_t output_channels = (uint32_t)output_dimensions[1];
    const uint64_t channel_plane = (uint64_t)height * width;
    const uint64_t weights_per_output = (uint64_t)input_channels * 49u;
    uint32_t batch;

    for (batch = 0u; batch < (uint32_t)input_dimensions[0]; ++batch) {
        const float* batch_input =
            input + (size_t)((uint64_t)batch * input_channels * channel_plane);
        float* batch_output =
            output + (size_t)((uint64_t)batch * output_channels * channel_plane);
        uint32_t output_channel;
        for (output_channel = 0u; output_channel < output_channels; ++output_channel) {
            const float* output_channel_weights =
                weights + (size_t)((uint64_t)output_channel * weights_per_output);
            float* output_channel_data =
                batch_output + (size_t)((uint64_t)output_channel * channel_plane);
            const float initial = bias == NULL ? 0.0f : bias[output_channel];
            const __m256 initial_values = _mm256_set1_ps(initial);
            uint64_t spatial = 0u;
            uint32_t input_channel;

            for (; spatial + 8u <= channel_plane; spatial += 8u) {
                _mm256_storeu_ps(output_channel_data + (size_t)spatial, initial_values);
            }
            for (; spatial < channel_plane; ++spatial) {
                output_channel_data[(size_t)spatial] = initial;
            }

            for (input_channel = 0u; input_channel < input_channels; ++input_channel) {
                const float* input_channel_data =
                    batch_input + (size_t)((uint64_t)input_channel * channel_plane);
                const float* weight_channel_data =
                    output_channel_weights + (size_t)((uint64_t)input_channel * 49u);
                uint32_t kernel_y;
                for (kernel_y = 0u; kernel_y < 7u; ++kernel_y) {
                    const uint32_t output_y_begin = kernel_y < 3u ? 3u - kernel_y : 0u;
                    const uint32_t output_y_end =
                        kernel_y > 3u ? height - (kernel_y - 3u) : height;
                    uint32_t kernel_x;
                    for (kernel_x = 0u; kernel_x < 7u; ++kernel_x) {
                        const uint32_t output_x_begin = kernel_x < 3u ? 3u - kernel_x : 0u;
                        const uint32_t output_x_end =
                            kernel_x > 3u ? width - (kernel_x - 3u) : width;
                        const float weight = weight_channel_data[kernel_y * 7u + kernel_x];
                        const __m256 weight_values = _mm256_set1_ps(weight);
                        uint32_t output_y;
                        for (output_y = output_y_begin; output_y < output_y_end; ++output_y) {
                            const uint32_t input_y = output_y + kernel_y - 3u;
                            const float* input_row =
                                input_channel_data + (size_t)((uint64_t)input_y * width);
                            float* output_row =
                                output_channel_data + (size_t)((uint64_t)output_y * width);
                            uint32_t output_x = output_x_begin;
                            for (; output_x + 8u <= output_x_end; output_x += 8u) {
                                const uint32_t input_x = output_x + kernel_x - 3u;
                                const __m256 input_values = _mm256_loadu_ps(input_row + input_x);
                                __m256 output_values = _mm256_loadu_ps(output_row + output_x);
                                output_values = _mm256_add_ps(
                                    output_values, _mm256_mul_ps(input_values, weight_values));
                                _mm256_storeu_ps(output_row + output_x, output_values);
                            }
                            for (; output_x < output_x_end; ++output_x) {
                                const uint32_t input_x = output_x + kernel_x - 3u;
                                output_row[output_x] += input_row[input_x] * weight;
                            }
                        }
                    }
                }
            }
        }
    }
#else
    lw_scalar_conv2d_f32(input, weights, bias, (uint32_t)output_dimensions[1], output,
                         input_dimensions, (const int32_t[4]){output_dimensions[1],
                                                               input_dimensions[1], 7, 7},
                         output_dimensions, (const int32_t[2]){7, 7},
                         (const int32_t[2]){1, 1}, (const int32_t[2]){1, 1},
                         (const int32_t[4]){3, 3, 3, 3}, 1u);
#endif
}

#if LW_COMPILES_AVX2_CONV7X7 && (defined(__GNUC__) || defined(__clang__))
__attribute__((target("avx2,no-fma")))
#endif
void lw_avx2_conv5x5_unit_pad2_f32(const float* input, const float* weights,
                                   const float* bias, float* output,
                                   const int32_t input_dimensions[4],
                                   const int32_t output_dimensions[4]) {
#if LW_COMPILES_AVX2_CONV7X7
    const uint32_t input_channels = (uint32_t)input_dimensions[1];
    const uint32_t height = (uint32_t)input_dimensions[2];
    const uint32_t width = (uint32_t)input_dimensions[3];
    const uint32_t output_channels = (uint32_t)output_dimensions[1];
    const uint64_t channel_plane = (uint64_t)height * width;
    const uint64_t weights_per_output = (uint64_t)input_channels * 25u;
    uint32_t batch;

    for (batch = 0u; batch < (uint32_t)input_dimensions[0]; ++batch) {
        const float* batch_input =
            input + (size_t)((uint64_t)batch * input_channels * channel_plane);
        float* batch_output =
            output + (size_t)((uint64_t)batch * output_channels * channel_plane);
        uint32_t output_channel;
        for (output_channel = 0u; output_channel < output_channels; ++output_channel) {
            const float* output_channel_weights =
                weights + (size_t)((uint64_t)output_channel * weights_per_output);
            float* output_channel_data =
                batch_output + (size_t)((uint64_t)output_channel * channel_plane);
            const float initial = bias == NULL ? 0.0f : bias[output_channel];
            const __m256 initial_values = _mm256_set1_ps(initial);
            uint64_t spatial = 0u;
            uint32_t input_channel;

            for (; spatial + 8u <= channel_plane; spatial += 8u) {
                _mm256_storeu_ps(output_channel_data + (size_t)spatial, initial_values);
            }
            for (; spatial < channel_plane; ++spatial) {
                output_channel_data[(size_t)spatial] = initial;
            }

            for (input_channel = 0u; input_channel < input_channels; ++input_channel) {
                const float* input_channel_data =
                    batch_input + (size_t)((uint64_t)input_channel * channel_plane);
                const float* weight_channel_data =
                    output_channel_weights + (size_t)((uint64_t)input_channel * 25u);
                uint32_t kernel_y;
                for (kernel_y = 0u; kernel_y < 5u; ++kernel_y) {
                    const uint32_t output_y_begin = kernel_y < 2u ? 2u - kernel_y : 0u;
                    const uint32_t output_y_end =
                        kernel_y > 2u ? height - (kernel_y - 2u) : height;
                    uint32_t kernel_x;
                    for (kernel_x = 0u; kernel_x < 5u; ++kernel_x) {
                        const uint32_t output_x_begin = kernel_x < 2u ? 2u - kernel_x : 0u;
                        const uint32_t output_x_end =
                            kernel_x > 2u ? width - (kernel_x - 2u) : width;
                        const float weight = weight_channel_data[kernel_y * 5u + kernel_x];
                        const __m256 weight_values = _mm256_set1_ps(weight);
                        uint32_t output_y;
                        for (output_y = output_y_begin; output_y < output_y_end; ++output_y) {
                            const uint32_t input_y = output_y + kernel_y - 2u;
                            const float* input_row =
                                input_channel_data + (size_t)((uint64_t)input_y * width);
                            float* output_row =
                                output_channel_data + (size_t)((uint64_t)output_y * width);
                            uint32_t output_x = output_x_begin;
                            for (; output_x + 8u <= output_x_end; output_x += 8u) {
                                const uint32_t input_x = output_x + kernel_x - 2u;
                                const __m256 input_values = _mm256_loadu_ps(input_row + input_x);
                                __m256 output_values = _mm256_loadu_ps(output_row + output_x);
                                output_values = _mm256_add_ps(
                                    output_values, _mm256_mul_ps(input_values, weight_values));
                                _mm256_storeu_ps(output_row + output_x, output_values);
                            }
                            for (; output_x < output_x_end; ++output_x) {
                                const uint32_t input_x = output_x + kernel_x - 2u;
                                output_row[output_x] += input_row[input_x] * weight;
                            }
                        }
                    }
                }
            }
        }
    }
#else
    lw_scalar_conv2d_f32(input, weights, bias, (uint32_t)output_dimensions[1], output,
                         input_dimensions, (const int32_t[4]){output_dimensions[1],
                                                               input_dimensions[1], 5, 5},
                         output_dimensions, (const int32_t[2]){5, 5},
                         (const int32_t[2]){1, 1}, (const int32_t[2]){1, 1},
                         (const int32_t[4]){2, 2, 2, 2}, 1u);
#endif
}
