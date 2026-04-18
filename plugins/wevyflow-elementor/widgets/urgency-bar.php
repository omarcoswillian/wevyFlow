<?php
namespace WevyFlow\Widgets;
use Elementor\Widget_Base;
use Elementor\Controls_Manager;

if (!defined('ABSPATH')) exit;

class Urgency_Bar extends Widget_Base {
    public function get_name() { return 'wf-urgency-bar'; }
    public function get_title() { return 'WevyFlow Urgency Bar'; }
    public function get_icon() { return 'eicon-alert'; }
    public function get_categories() { return ['wevyflow']; }

    protected function register_controls() {
        $this->start_controls_section('content', ['label' => 'Conteudo']);
        $this->add_control('text_before', ['label' => 'Texto destaque', 'type' => Controls_Manager::TEXT, 'default' => 'O preco vai aumentar R$ 200,00']);
        $this->add_control('text_after', ['label' => 'Texto complementar', 'type' => Controls_Manager::TEXT, 'default' => 'nesta segunda-feira — inscreva-se agora e economize.']);
        $this->add_control('bg_color', ['label' => 'Cor de fundo', 'type' => Controls_Manager::COLOR, 'default' => '#b8132a']);
        $this->end_controls_section();
    }

    protected function render() {
        $s = $this->get_settings_for_display();
        ?>
        <div class="wf-urgency" style="background:<?php echo esc_attr($s['bg_color']); ?>">
            <span class="wf-urgency-dot"></span>
            <span><strong><?php echo esc_html($s['text_before']); ?></strong> <?php echo esc_html($s['text_after']); ?></span>
        </div>
        <?php
    }
}
