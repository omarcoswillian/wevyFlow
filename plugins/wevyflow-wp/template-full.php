<?php
/**
 * Template de página completa — renderiza APENAS o HTML do WevyFlow.
 * Nenhum header/footer/CSS do tema WordPress é carregado.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

$post_id = get_queried_object_id();
$html    = get_post_meta( $post_id, '_wevyflow_html', true );

if ( empty( $html ) ) {
    status_header( 404 );
    wp_die( '<p style="font-family:sans-serif;text-align:center;margin-top:80px;color:#6b7280">Página WevyFlow não encontrada.</p>', 'Página não encontrada', [ 'response' => 404 ] );
}

// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
echo $html;
exit;
