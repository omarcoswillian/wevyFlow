<?php
namespace WevyFlow\Widgets;
use Elementor\Widget_Base;
use Elementor\Controls_Manager;

if (!defined('ABSPATH')) exit;

class Split_Section extends Widget_Base {
    public function get_name() { return 'wf-split-section'; }
    public function get_title() { return 'WevyFlow Split Section'; }
    public function get_icon() { return 'eicon-image-before-after'; }
    public function get_categories() { return ['wevyflow']; }

    protected function register_controls() {
        $this->start_controls_section('content', ['label' => 'Conteudo']);
        $this->add_control('number', ['label' => 'Numero', 'type' => Controls_Manager::TEXT, 'default' => '01']);
        $this->add_control('label', ['label' => 'Label', 'type' => Controls_Manager::TEXT, 'default' => 'A oportunidade']);
        $this->add_control('heading', ['label' => 'Titulo', 'type' => Controls_Manager::TEXTAREA, 'default' => 'Uma simples leitura pode se transformar em uma nova fonte de renda']);
        $this->add_control('heading_highlight', ['label' => 'Parte em destaque', 'type' => Controls_Manager::TEXT, 'default' => 'nova fonte de renda']);
        $this->add_control('paragraph_1', ['label' => 'Paragrafo 1', 'type' => Controls_Manager::TEXTAREA, 'default' => 'Voce passa horas lendo e ainda nao percebeu: esta a poucas paginas de construir uma nova fonte de renda.']);
        $this->add_control('paragraph_2', ['label' => 'Paragrafo 2', 'type' => Controls_Manager::TEXTAREA, 'default' => 'Quando voce entender isso, vai multiplicar seus ganhos em poucas semanas.']);
        $this->add_control('image', ['label' => 'Imagem', 'type' => Controls_Manager::MEDIA]);
        $this->add_control('reverse', ['label' => 'Inverter (imagem direita)', 'type' => Controls_Manager::SWITCHER, 'default' => '']);
        $this->add_control('dark_mode', ['label' => 'Modo escuro', 'type' => Controls_Manager::SWITCHER, 'default' => 'yes']);
        $this->end_controls_section();
    }

    protected function render() {
        $s = $this->get_settings_for_display();
        $dark = ($s['dark_mode'] ?? '') === 'yes';
        $heading = esc_html($s['heading']);
        $hl = esc_html($s['heading_highlight']);
        if ($hl) $heading = str_replace($hl, '<em>' . $hl . '</em>', $heading);
        $rev = ($s['reverse'] ?? '') === 'yes' ? ' wf-split--reverse' : '';
        $img = $s['image'] ?? [];
        $hasImg = is_array($img) && !empty($img['url']);
        ?>
        <div class="wf-block<?php echo $dark ? ' wf-block--dark' : ''; ?>">
            <div class="wf-content">
                <div class="wf-wrap">
                    <div class="wf-split wf-rv<?php echo $rev; ?>">
                        <div class="wf-split-media">
                            <?php if ($hasImg): ?>
                                <img src="<?php echo esc_url($s['image']['url']); ?>" alt="">
                            <?php else: ?>
                                <div class="wf-ph"><span class="wf-ph-label">Imagem</span></div>
                            <?php endif; ?>
                        </div>
                        <div class="wf-split-text">
                            <div class="wf-label"><span class="wf-num"><?php echo esc_html($s['number']); ?></span> <?php echo esc_html($s['label']); ?></div>
                            <h2><?php echo $heading; ?></h2>
                            <?php if ($s['paragraph_1']): ?><p><?php echo esc_html($s['paragraph_1']); ?></p><?php endif; ?>
                            <?php if ($s['paragraph_2']): ?><p><?php echo esc_html($s['paragraph_2']); ?></p><?php endif; ?>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }
}
